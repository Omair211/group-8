import scraper
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import undetected_chromedriver as uc
import zipfile
from contextlib import contextmanager

USER_AGENTS = [
    # "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    # "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
]

proxies = [
    "https://spijrnb5g3:x4lOx+ZaCj73ifxC7u@gate.smartproxy.com:7000",
    "https://spijrnb5g3:x4lOx+ZaCj73ifxC7u@gate.smartproxy.com:7000",
]

@contextmanager
def create_driver_with_proxy(proxy):
    """Context manager to handle the driver's lifecycle."""
    driver = None
    try:
        driver = create_driver(proxy)
        yield driver
    except Exception as e:
        print(f"[ERROR] Error in driver context: {e}")
    finally:
        if driver:
            print("[INFO] Closing driver")
            driver.quit()

def create_driver(proxy):
    """
    Creates a new Chrome driver instance with SmartProxy authentication.
    """
    chrome_options = uc.ChromeOptions()
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument(f"user-agent={random.choice(USER_AGENTS)}")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")

    chrome_options.add_argument("--ignore-certificate-errors")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--proxy-bypass-list=*")
    chrome_options.add_argument("--proxy-server-direct")

    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument("--disable-popup-blocking")
    chrome_options.add_argument("--disable-infobars")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-extensions")

    chrome_options.add_argument("--disable-webgl")
    chrome_options.add_argument("--disable-web-security")

    proxy_extension = create_proxy_extension(proxy)
    chrome_options.add_extension(proxy_extension)
    driver = uc.Chrome(options=chrome_options, use_subprocess=True)

    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    return driver

def create_proxy_extension(proxy_url):
    """Creates a Chrome extension to handle proxy authentication with HTTPS."""
    username = proxy_url.split("//")[1].split(":")[0]
    password = proxy_url.split(":")[1].split("@")[0]
    proxy_host = proxy_url.split("@")[1].split(":")[0]
    proxy_port = proxy_url.split(":")[-1]

    manifest_json = """
    {
        "version": "1.0.0",
        "manifest_version": 2,
        "name": "Chrome Proxy Auth",
        "permissions": ["proxy", "tabs", "unlimitedStorage", "storage", "<all_urls>", "webRequest", "webRequestBlocking"],
        "background": {
            "scripts": ["background.js"]
        },
        "minimum_chrome_version":"22.0.0"
    }
    """

    # ✅ Forces HTTPS proxy type
    background_js = f"""
    var config = {{
        mode: "fixed_servers",
        rules: {{
            singleProxy: {{
                scheme: "https",
                host: "{proxy_host}",
                port: parseInt("{proxy_port}")
            }},
            bypassList: []
        }}
    }};

    chrome.proxy.settings.set({{value: config, scope: "regular"}}, function() {{}});

    chrome.webRequest.onAuthRequired.addListener(
        function(details, callback) {{
            callback({{authCredentials: {{username: "{username}", password: "{password}"}}}});
        }},
        {{urls: ["<all_urls>"]}},
        ["blocking"]
    );
    """

    plugin_file = f"proxy_auth_plugin_{proxy_host}_{proxy_port}.zip"

    with zipfile.ZipFile(plugin_file, 'w') as zp:
        zp.writestr("manifest.json", manifest_json)
        zp.writestr("background.js", background_js)

    return plugin_file

def scrape_url(url, proxy, retries=3, delay=5):
    """
    Attempts to scrape a URL using TCG_PLAYER_ITEM_DATA.run(url).
    Retries up to 'retries' times if an exception occurs.
    Ensures that driver.quit() always runs to prevent hanging processes.
    """
    for attempt in range(retries):
        try:
            with create_driver_with_proxy(proxy) as driver:
                result = scraper.run(url, driver=driver)
                return result
        except Exception as e:
            print(f"[ERROR] Attempt {attempt+1}/{retries} for URL {url} failed: {e}")
            time.sleep(delay)  # Retry delay
            driver.quit()

    return None  # Return None if all retries fail

def ma(links):
    # Load your list of URLs
    urls = links
    results = []
    max_workers = len(proxies)  # Use as many threads as there are proxies
    
    # Assign each URL to a different proxy
    url_proxy_pairs = [(url, proxies[i % len(proxies)]) for i, url in enumerate(urls)]

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_url = {executor.submit(scrape_url, url, proxy): url for url, proxy in url_proxy_pairs}
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                data = future.result()
                if data is not None:
                    results.append(data)
                    print(f"[DEBUG] Completed scraping: {url}")
                else:
                    print(f"[ERROR] URL {url} failed after retries.")
            except Exception as e:
                print(f"[ERROR] URL {url} generated an exception: {e}")

    print(f"Scraping complete. Collected {len(results)} results.")
    return results

def test_driver(proxy):
    driver = create_driver(proxy)
    driver.get("https://www.google.com")
    time.sleep(5)
    driver.quit()

# if __name__ == "__main__":
#     main()
    # test_driver(proxies[0])