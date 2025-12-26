/**
 * EURO.COM.PL BROWSER SCRAPER
 * ---------------------------
 * Copy and paste this entire script into the Developer Console (F12) 
 * while on the euro.com.pl website.
 */

(async function scrapeEuro() {
    // Configuration
    const CATEGORY = "telefony-komorkowe";
    const BATCH_SIZE = 20; // Number of items per request
    
    // Store results here
    let allProducts = [];
    let offset = 0;
    let totalItems = null; 
    let keepFetching = true;

    console.clear();
    console.log("%c🚀 Starting Euro.com.pl Scraper...", "color: lime; font-size: 16px; font-weight: bold;");

    while (keepFetching) {
        // Construct the API URL dynamically
        // We use the same parameters your browser used, but we change 'startFrom'
        const url = `https://www.euro.com.pl/rest/api/products/search?category=${CATEGORY}&orderBy=POPULARITY&direction=ASC&startFrom=${offset}&numberOfItems=${BATCH_SIZE}&_a=1&developSearchMode=false`;

        try {
            console.log(`%c📡 Fetching items ${offset} to ${offset + BATCH_SIZE}...`, "color: cyan");
            
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' } 
                // Note: No other headers needed, browser attaches cookies automatically!
            });

            if (!response.ok) {
                console.error("❌ Request failed:", response.status);
                break;
            }

            const data = await response.json();

            // Set total items count if this is the first run
            if (totalItems === null) {
                totalItems = data.productsCount;
                console.log(`%c📦 Total products found in category: ${totalItems}`, "color: yellow");
            }

            const results = data.results;

            // Stop if no results returned
            if (!results || results.length === 0) {
                keepFetching = false;
                break;
            }

            // Process this batch
            results.forEach(item => {
                const ids = item.identifiers || {};
                const prices = item.prices || {};
                
                // Price Logic: 
                // mainPrice is what you pay. oldPrice exists only on discount.
                const currentPrice = prices.mainPrice;
                const oldPrice = prices.oldPrice;

                let regularPrice, discountedPrice;

                if (oldPrice) {
                    regularPrice = oldPrice;
                    discountedPrice = currentPrice;
                } else {
                    regularPrice = currentPrice;
                    discountedPrice = ""; // Empty if no discount
                }

                // Image Logic:
                // Check 'photo' string first, then 'images' array
                let imgUrl = item.photo;
                if (!imgUrl && item.images && item.images.length > 0) {
                    // Sometimes images is an array of objects, sometimes strings
                    imgUrl = item.images[0].url || item.images[0];
                }

                allProducts.push({
                    name: item.name,
                    code: ids.plu, // 'nr kat'
                    regular_price: regularPrice,
                    discounted_price: discountedPrice,
                    link: `https://www.euro.com.pl/${ids.productGroupLinkName || 'telefony-komorkowe'}/${ids.productLinkName}.bhtml`,
                    image: imgUrl
                });
            });

            // Increment offset for next page
            offset += results.length;

            // Check if we are done
            if (offset >= totalItems) {
                keepFetching = false;
                console.log("%c✅ Reached end of list.", "color: lime");
            } else {
                // Be polite to the server: wait a bit between requests (random 500ms-1500ms)
                const delay = Math.floor(Math.random() * 1000) + 500;
                await new Promise(r => setTimeout(r, delay));
            }

        } catch (e) {
            console.error("❌ Error fetching data:", e);
            break;
        }
    }

    console.log(`%c🎉 Scraping complete. Collected ${allProducts.length} items. Generating CSV...`, "color: lime; font-weight: bold;");
    downloadCSV(allProducts);
})();

// Helper function to trigger CSV download
function downloadCSV(data) {
    if (!data.length) {
        console.warn("No data to save!");
        return;
    }

    const headers = ["Product Name", "Product Code (Nr kat)", "Regular Price", "Discounted Price", "Link", "Image URL"];
    const csvRows = [headers.join(",")];

    data.forEach(row => {
        const values = [
            `"${(row.name || "").replace(/"/g, '""')}"`, // Escape quotes inside name
            `"${row.code || ""}"`,
            row.regular_price,
            row.discounted_price,
            `"${row.link}"`,
            `"${row.image}"`
        ];
        csvRows.push(values.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "euro_smartphones_list.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}