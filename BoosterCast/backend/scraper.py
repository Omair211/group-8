import time
import json
import random
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, TimeoutException, StaleElementReferenceException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from list_helper import merge_two_lists
from file_operations_helper import write_to_json_file


TEST_CASE = "https://www.tcgplayer.com/product/593294/pokemon-sv-prismatic-evolutions-prismatic-evolutions-booster-pack?page=1&Language=all"


def run(url, driver, scrape_duration=60):
    output = get_product_market_price_history(url, driver, scrape_duration)
    driver.quit()
    return output

def get_product_market_price_history(url, driver, scrape_duration):
    results = []
    driver.get(url)
    product_title = WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, "h1.product-details__name")))
    product_id = extract_product_id(url)
    chart_table = []
    image_url = None
    close_cookie_button(driver)
    title = driver.find_element(By.CSS_SELECTOR, "h1.product-details__name").text
    text = driver.find_element(By.CSS_SELECTOR, "ul.product__item-details__attributes").text
    category_container = driver.find_element(By.CSS_SELECTOR, "div.product-details__name__sub-header").text
    if product_id:
        image_url = f"https://tcgplayer-cdn.tcgplayer.com/product/{product_id}_in_200x200.jpg"
        print("Image URL:", image_url)
    chart = driver.find_element(By.CSS_SELECTOR, "div.chart-container")
    table = chart.find_elements(By.TAG_NAME, "td")
    for td in table:
        chart_table.append(td.get_attribute("textContent").strip())

    market_history_data_toggle = driver.find_element(By.CSS_SELECTOR, "div.modal__activator")
    market_history_data_toggle.click()
    
    history_snapshot_element = driver.find_element(By.CSS_SELECTOR, "section.sales-history-snapshot")
    scroll_inside_element(driver, history_snapshot_element)

    iterations = scrape_duration // 2
    output = click_until_gone(driver, "div.sales-history-snapshot__load-more", By.TAG_NAME, "button", results, iterations)
    
    return {"title": title, "text": text, "img": image_url, "chart_data": chart_table, "category": category_container, "output":output}

def close_cookie_button(driver):
    allow_button = driver.find_element(By.CSS_SELECTOR, "span.allow-button")
    allow_button.find_element(By.TAG_NAME, "button").click()

import random

def click_until_gone(driver, container_selector, by, selector, results, max_iterations):
    iteration = 0
    while iteration < max_iterations:
        try:
            container = driver.find_element(By.CSS_SELECTOR, container_selector)
        except Exception as e:
            print(f"[DEBUG] Could not re-find container '{container_selector}'. Exiting. Error: {e}")
            break

        try:
            element = WebDriverWait(container, 10).until(
                EC.element_to_be_clickable((by, selector))
            )
            print(f"[DEBUG] Found clickable button '{selector}'.")
        except TimeoutException:
            print(f"[DEBUG] Button '{selector}' not found. Exiting loop.")
            break

        try:
            # ✅ Simulate human-like behavior before clicking
            # time.sleep(0.5)  # Randomized wait
            ActionChains(driver).move_to_element(element).pause(random.uniform(0.5, 1)).click().perform()
            print(f"[DEBUG] Click executed.")
        except Exception as e:
            print(f"[DEBUG] Exception during click: {e}")
            break

        # ✅ Wait longer to mimic a real user waiting for page updates
        # time.sleep(random.uniform(0.5, 1))

        rows = gather_data(driver, "tbody.latest-sales-table__tbody")
        results = merge_two_lists(results, rows)
        print(f"[DEBUG] Gathered {len(rows)} rows.")
        removed_count = remove_old_data(driver,"tbody.latest-sales-table__tbody", 25)
        print(f"[DEBUG] Removed {removed_count} old rows at iteration {iteration}.")

        iteration += 1
        print(iteration)
    return results

def gather_data(driver, container_selector):
    try:
        rows = driver.find_elements(By.CSS_SELECTOR, f"{container_selector} tr")
        data = []
        for row in rows:
            cells = row.find_elements(By.TAG_NAME, "td")
            if len(cells) >= 4:
                data.append({
                    "date": cells[0].text.strip(),
                    "condition": cells[1].text.strip(),
                    "quantity": cells[2].text.strip(),
                    "price": cells[3].text.strip(),
                })
        return data
    except Exception as e:
        print(f"[ERROR] Failed to gather data: {e}")
        return []


def remove_old_data(driver, container_selector, num_to_remove=50):
    """
    Remove the first num_to_remove child elements from the container specified by container_selector.
    Returns the number of elements removed.
    """
    script = """
    var container = document.querySelector(arguments[0]);
    var count = 0;
    if (container) {
        var children = container.children;
        var items = Array.from(children);
        for (var i = 0; i < Math.min(items.length, arguments[1]); i++) {
            items[i].remove();
            count++;
        }
    }
    return count;
    """
    removed_count = driver.execute_script(script, container_selector, num_to_remove)
    print(f"[DEBUG] Removed {removed_count} elements from {container_selector}.")
    return removed_count

def wait_for_new_rows(driver, container_selector, old_row_count, timeout=10):
    """
    Wait up to 'timeout' seconds for the row count in 'container_selector' to exceed 'old_row_count'.
    Returns True if new rows appear, otherwise False.
    """
    start_time = time.time()
    while time.time() - start_time < timeout:
        rows = gather_data(driver, container_selector)
        if len(rows) > old_row_count:
            return True
    return False


def scroll_inside_element(driver, element, pause_time=2):
    """
    Scrolls once inside a specific element to its bottom.
    
    Parameters:
        driver: Selenium WebDriver instance.
        element: The scrollable element.
        pause_time: Seconds to wait after scrolling to allow content to load.
    """
    try:
        print(f"[DEBUG] Scrolling inside element: {element}")
        driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", element)
        print("[DEBUG] Scroll executed. Waiting for content to load...")
        time.sleep(pause_time)
    except Exception as e:
        print(f"[DEBUG] Error scrolling inside element: {e}")


import re

def extract_product_id(url):
    match = re.search(r'/product/(\d+)/', url)
    return match.group(1) if match else None