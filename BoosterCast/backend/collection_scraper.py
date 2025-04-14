import time
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def close_cookie_button(driver):
    try:
        allow_button = driver.find_element(By.CSS_SELECTOR, "span.allow-button")
        allow_button.find_element(By.TAG_NAME, "button").click()
    except Exception as e:
        print(f"Error closing cookie button: {e}")

import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def scrape_collections(driver):
    # Base URL without the page number
    base_url = "https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&view=grid&ProductTypeName=Sealed+Products&page="
    
    page = 1

    

    while True:
        url = base_url + str(page)

        print(f"Scraping page {page}: {url}")
        driver.get(url)

        time.sleep(2)
        close_cookie_button(driver)
        
        # Wait for the page to load results
        try:
            # Wait until at least one element with the search-results class is present
            results = WebDriverWait(driver, 10).until(
                EC.presence_of_all_elements_located((By.CSS_SELECTOR, "div.search-result"))
            )
        except Exception as e:
            print(f"No search results on page {page} (or an error occurred): {e}")
            break

        if not results or len(results) == 0:
            print(f"No results found on page {page}. Ending loop.")
            break

        # Loop through each result to get its on-hover link.
        for result in results:
            try:
                title = result.find_element(By.CSS_SELECTOR, "span.product-card__title").text
                category = result.find_element(By.CSS_SELECTOR, "div.product-card__set-name__variant").text
                link = result.get_attribute("data-href")

                if not link:
                    try:
                        # Fallback: search for an anchor element inside the result
                        anchor = result.find_element(By.TAG_NAME, "a")
                        link = anchor.get_attribute("href")
                    except Exception as e:
                        print("No link found in one result:", e)
                        continue  # Skip this result if no link is found

                if link:
                    product_id = extract_product_id(link)
                    if product_id:
                        img_url = f"https://tcgplayer-cdn.tcgplayer.com/product/{product_id}_in_200x200.jpg"
                    else:
                        img_url = ""

                    price = result.find_element(By.CSS_SELECTOR, "span.product-card__market-price--value").text
                    price = price.replace("$", "").replace(",", "")
                    price = float(price) if price else None
                    print(f"Title: {title}, Category: {category}, Link: {link}, Price: {price}")
                    # Yield the link and its data as soon as it is found
                    yield {
                        "title": title,
                        "category": category,
                        "img": img_url,
                        "link": link,
                        "price": price
                    }
                    print(f"Found link: {link}")

            except Exception as e:
                print(f"Error processing a result: {e}")
                continue  # Skip this result and continue with the next one

        time.sleep(1)
        page += 1

    driver.quit()

import re

def extract_product_id(url):
    match = re.search(r'/product/(\d+)/', url)
    return match.group(1) if match else None