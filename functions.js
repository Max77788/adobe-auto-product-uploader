const dotenv = require('dotenv');
dotenv.config();
const { v4: uuidv4 } = require('uuid');

const sharp = require('sharp');

// Replace 'yourProductIdHere' with the actual product ID.
const productId = '550666600';

const PRINTPRONTO_API_BASE_URL = "https://printpronto.com/rest/default/V1";

 async function fetchProduct(productId) {
    try {
        const response = await fetch(`https://api.asicentral.com/v1/products/${productId}.json`, {
            method: 'GET',
            headers: {
                "Authorization": `AsiMemberAuth ${process.env.ASICENTRAL_API_KEY}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        return data;
        console.log('Product data:', data);
    } catch (error) {
        console.error('Error fetching product:', error);
    }
}

 async function createConfigurableProduct(product_data) {
    const uuid = uuidv4();

    const product = {
        "product": {
            "sku": `${product_data.Id.slice(0, 4)}-${product_data.Name.replace(/"/g, "").replace(/ /g, "")}-${uuid.substring(0, 3)}`,
            "name": `${product_data.Name.replace(/"/g, '\\"')}-${uuid.substring(0, 3)}`,
            "attribute_set_id": 75,
            "price": product_data.LowestPrice.Price,
            "type_id": "configurable",
            "status": 1,
            "visibility": 4
        }
    };
}

 async function findAttributeOptions(attribute_id) {
    const response = await fetch(`${PRINTPRONTO_API_BASE_URL}/products/attributes/${attribute_id}/options`, {
        method: 'GET',
        headers: {
            "Authorization": `Bearer ${process.env.PRINTPRONTO_API_TOKEN}`
        }
    });

    const result = await response.json();

    console.log(result);

    return result;   
}

 async function addNewOptionsToTheAttribute(list_of_attribute_names, attribute_id) {
    const options = await findAttributeOptions(attribute_id);
    for (option_name of list_of_attribute_names) {
        const option = options.find(opt => opt.label === option_name);
        if (!option) {
 
            const newOption = {
                "option": {
                    label: JSON.stringify(option_name),
                    is_default: false
                }
            };

            const response = await fetch(`${PRINTPRONTO_API_BASE_URL}/products/attributes/${attribute_id}/options`, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${process.env.PRINTPRONTO_API_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(newOption)
            });
            const result = await response.json();
            console.log(result);
        } else {
            console.log(`Option "${option_name}" already exists.`);
        }
    }
}

 async function addNewSingleOptionToTheAttribute(option_name, attribute_id) {
    const newOption = {
        "option": {
            label: option_name,
            is_default: false
        }
    };

    const response = await fetch(`${PRINTPRONTO_API_BASE_URL}/products/attributes/${attribute_id}/options`, {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${process.env.PRINTPRONTO_API_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(newOption)
    });
    const result = await response.json();
    console.log(result);
    }


async function setOptionOfConfigProductAttribute(attribute_id, attribute_label, option_value, config_product_id, config_product_sku, position = 0) {
    console.log("[DEBUG] Function called: setOptionOfConfigProductAttribute");
    console.log("[DEBUG] Parameters received:");
    console.log("  - attribute_id:", attribute_id);
    console.log("  - attribute_label:", attribute_label);
    console.log("  - option_value:", option_value);
    console.log("  - config_product_id:", config_product_id);
    console.log("  - config_product_sku:", config_product_sku);
    console.log("  - position:", position);

    const newOption = {
        "option": {
            "attribute_id": attribute_id,
            "label": attribute_label,
            "position": position,
            "values": [
                {
                    "value_index": Number(option_value.value),
                }
            ],
            "product_id": Number(config_product_id),
        }
    };

    console.log("[DEBUG] Constructed newOption payload:");
    console.log(JSON.stringify(newOption, null, 2));

    const url = `${PRINTPRONTO_API_BASE_URL}/configurable-products/${config_product_sku}/options`;
    console.log("[DEBUG] API URL:", url);

    const headers = {
        "Authorization": `Bearer ${process.env.PRINTPRONTO_API_TOKEN}`,
        "Content-Type": "application/json"
    };
    console.log("[DEBUG] Request headers:", headers);

    try {
        console.log("[DEBUG] Sending POST request to Magento API...");
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(newOption)
        });

        console.log("[DEBUG] Response received");
        console.log("  - Status:", response.status);
        console.log("  - Status Text:", response.statusText);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("[ERROR] Failed to set option. Response body:", errorBody);
        } else {
            const data = await response.json();
            console.log("[SUCCESS] Option set successfully. Response data:", data);
        }
    } catch (error) {
        console.error("[EXCEPTION] An error occurred while setting the option:", error);
    }
}

async function createSimpleProduct(config_product_id, config_product_name, attribute_set_id, quantity, quantity_price, custom_attributes) {
    const uniqueId = uuidv4().substring(0, 4);
    
    const productSku = `${config_product_id}-${config_product_name.replace(/"/g, "").replace(/ /g, "").replace(":", "-")}-${uniqueId}`;

    const product = {
        product: {
            sku: productSku,
            name: `${config_product_name}-${quantity}-${uniqueId}`,
            attribute_set_id, // This must be provided (or defined earlier)
            price: quantity_price,
            type_id: "simple",
            status: 1,
            visibility: 1,
            custom_attributes,
            extension_attributes: {
                stock_item: {
                    qty: 1000000,
                    is_in_stock: true
                }
            }
        }
    };
    
    const response = await fetch(`${process.env.PRINTPRONTO_API_BASE_URL}/rest/default/V1/products`, {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${process.env.PRINTPRONTO_API_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(product)
    });

    console.log("Response from creating simple product:", response.status, response.statusText);
    
    // Optionally, you might want to handle and return the response.
    return productSku;
}

async function assignSimpleProductToConfigurable(child_product_sku, config_product_sku) {
    console.log("Function called: assignSimpleProductToConfigurable");
    console.log("Child Product SKU:", child_product_sku);
    console.log("Configurable Product SKU:", config_product_sku);

    const payload = {
        "childSku": child_product_sku,
    };
    console.log("Payload constructed:", payload);

    const url = `${process.env.PRINTPRONTO_API_BASE_URL}/rest/default/V1/configurable-products/${config_product_sku}/child`;
    console.log("API URL:", url);

    const headers = {
        "Authorization": `Bearer ${process.env.PRINTPRONTO_API_TOKEN}`,
        "Content-Type": "application/json"
    };
    console.log("Request headers:", headers);

    try {
        console.log("Sending POST request...");
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        console.log("Response received");
        console.log("Response status:", response.status);
        console.log("Response status text:", response.statusText);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Error response body:", errorBody);
        } else {
            const data = await response.json();
            console.log("Success response data:", data);
        }

    } catch (error) {
        console.error("Error while assigning simple product to configurable:", error);
    }
}

// Function to fetch attribute options
async function findAttributeOptions(attribute_id) {
    try {
        const response = await fetch(`${PRINTPRONTO_API_BASE_URL}/products/attributes/${attribute_id}/options`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${process.env.PRINTPRONTO_API_TOKEN}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch options for attribute ID ${attribute_id}: ${response.statusText}`);
        }

        const result = await response.json();

        return result;
    } catch (error) {
        console.error(`Error fetching options for attribute ID ${attribute_id}:`, error.message);
        return { error: error.message };
    }
}

function cleanLabel(label) {
    return label.replace(/"/g, '').trim();
}


async function fetchWithRetry(url, maxRetries = 3, delayMs = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[DEBUG] Attempt ${attempt} to fetch URL: ${url}`);
            const response = await fetch(url);
            return response;
        } catch (error) {
            // Check if this is a network-related error like ECONNRESET
            console.error(`[ERROR] Fetch attempt ${attempt} failed with error: ${error.message}`);
            if (attempt < maxRetries) {
                console.log(`[DEBUG] Retrying in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
                console.error(`[ERROR] All ${maxRetries} attempts failed.`);
                throw error;
            }
        }
    }
}

async function convertAndUpscaleWebpToJpg(webpBuffer) {
    try {
        // Step 1: Get metadata to calculate new dimensions
        const metadata = await sharp(webpBuffer).metadata();
        const newWidth = metadata.width * 3;
        const newHeight = metadata.height * 3;

        // Step 2: Resize and convert to JPEG
        const jpgBuffer = await sharp(webpBuffer)
            .resize(newWidth, newHeight, {
                fit: 'inside', // Preserves aspect ratio
                kernel: sharp.kernel.lanczos3, // High-quality upscale
            })
            .toFormat('jpeg')
            .toBuffer();

        console.log('Upscaling and conversion successful. JPEG buffer size:', jpgBuffer.length);
        return jpgBuffer;
    } catch (error) {
        console.error('Error converting and upscaling image buffer:', error);
        throw error;
    }
}


async function addImageToProduct(imageUrl, productName, positionNumber, config_product_sku, isThumbnail = false) {
    // Construct the full URL for the image.
    const fullImageUrl = `https://api.asicentral.com/v1/${imageUrl}`;
    console.log("Fetching image from:", fullImageUrl);

    try {
        // Use the fetchWithRetry helper to attempt fetching the image.
        const response_init = await fetchWithRetry(fullImageUrl, 10, 2000);
        
        
        console.log("Fetch complete. Full response:", response_init);

        console.log("URL: ", response_init.url)

        const directImageUrl = response_init.url.split("?")[0];
        
        const response = await fetchWithRetry(directImageUrl, 10, 2000);

        if (!response.ok) {
            throw new Error(`Failed to fetch image. Status: ${response.status}`);
        }

        console.log("Converting response to array buffer...");
        const arrayBuffer = await response.arrayBuffer();
        console.log("ArrayBuffer conversion complete.");

        // Create a Node.js Buffer from the ArrayBuffer.
        const webpBuffer = Buffer.from(arrayBuffer);
        // console.log("Buffer created. Buffer size (bytes):", imageBuffer.length);

        const jpgBuffer = await convertAndUpscaleWebpToJpg(webpBuffer);
        
        // Convert the Buffer to a base64 string.
        const base64data = jpgBuffer.toString('base64');
        console.log("Successfully converted image to base64");

        // First, try to get the file name from the Content-Disposition header.
        const contentDisposition = response.headers.get('content-disposition');
        let filename;
        if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(contentDisposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }

        // Fallback: if no filename in header, derive from the final URL.
        if (!filename) {
            filename = path.basename(url.parse(response.url).pathname);
        }

        filename = filename.split(".")[0] + ".jpg"; // Ensure the filename ends with .jpg
        console.log("Determined filename: ", filename);

        // Construct the payload with the base64 data.
        const payload_thumbnail = {
            "entry": {
                "media_type": "image",
                "label": `${productName.replace(" ", "_")}-image-${uuidv4().substring(0, 4)}-THUMBANAIL`,
                "position": 1,
                "disabled": false,
                "types": ["thumbnail", "image", "small_image"],
                "file": filename,
                "content": {
                    "base64_encoded_data": base64data,
                    "type": "image/jpeg",
                    "name": filename
                }
            }
        };

        // Construct the payload with the base64 data.
        const payload_non_thumbnail = {
            "entry": {
                "media_type": "image",
                "label": `${productName.replace(" ", "_")}-image-${uuidv4().substring(0, 4)}`,
                "position": positionNumber,
                "disabled": false,
                "types": ["image", "small_image"],
                "file": filename,
                "content": {
                    "base64_encoded_data": base64data,
                    "type": "image/jpeg",
                    "name": filename
                }
            }
        };

        const payload = isThumbnail ? payload_thumbnail : payload_non_thumbnail;

        console.log("Constructed payload:", payload_thumbnail);
        const response_post_image = await fetch(`${process.env.PRINTPRONTO_API_BASE_URL}/rest/default/V1/products/${config_product_sku}/media`, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${process.env.PRINTPRONTO_API_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const response_json = await response_post_image.json();
        
        console.log("Image upload response status:", response_json);

        return response_json;

    } catch (error) {
        console.error("Error in addImageToProduct:", error);
        throw error;
    }
}

function replaceFractionsWithDecimals(input) {
    // This regex matches a whole number followed by a fraction that is
    // optionally followed by whitespace and either a double quote or the end of the string.
    return input.replace(/(\d+)\s+(\d+)\/(\d+)(?=\s*("|$))/g, (match, whole, numerator, denominator) => {
        const wholeNumber = parseInt(whole, 10);
        const fraction = parseInt(numerator, 10) / parseInt(denominator, 10);
        const decimalValue = wholeNumber + fraction;
        // Round the result to 2 decimal places.
        const rounded = Math.round(decimalValue * 100) / 100;
        // Format as a string with exactly 2 decimals.
        return rounded.toFixed(2);
    });
}

async function processProduct(req) {
    try {
        console.log("[DEBUG] processProduct function started.");

        // Destructure payload from req.body
        let {
            color_attribute_id,
            color_attribute_label,
            size_attribute_id,
            size_attribute_label,
            material_attribute_id,
            material_attribute_label,
            shape_attribute_id,
            shape_attribute_label,
            quantity_attribute_id,
            quantity_attribute_label,
            printpronto_config_product_id,
            printpronto_config_product_sku,
            esp_product_id,
            price_multiplier,
            attribute_set_id
        } = req.body;
        console.log("[DEBUG] Destructured parameters:", {
            color_attribute_id,
            size_attribute_id,
            material_attribute_id,
            shape_attribute_id,
            quantity_attribute_id,
            printpronto_config_product_id,
            printpronto_config_product_sku,
            esp_product_id,
            price_multiplier,
            attribute_set_id
        });

        // Overwrite/assign fixed attribute values as needed
        material_attribute_id = "412";
        material_attribute_label = "stickers_labels_material";
        color_attribute_id = "666";
        color_attribute_label = "stickers_and_labels_color";
        shape_attribute_id = "416";
        shape_attribute_label = "stickers_labels_shape";
        size_attribute_id = "415";
        size_attribute_label = "stickers_labels_size";
        quantity_attribute_id = "413";
        quantity_attribute_label = "stickers_labels_quantity";
        attribute_set_id = 75;

        // Fetch the product using the provided esp_product_id
        console.log("[DEBUG] Fetching product with esp_product_id:", esp_product_id);
        const product = await fetchProduct(esp_product_id);
        console.log("[DEBUG] Fetched product:", product);

        // Initialize mapping objects and arrays
        const attributeMapping = {};
        const productQuantitiesPrice = [];
        console.log("[DEBUG] Initialized attributeMapping and productQuantitiesPrice.");

        // Colors attribute
        if (color_attribute_id && product.Attributes && product.Attributes.Colors) {
            console.log("[DEBUG] Processing Colors attribute.");
            attributeMapping.Colors = {
                attribute_id: color_attribute_id,
                attribute_label: color_attribute_label,
                productValues: (product.Attributes.Colors && product.Attributes.Colors.Values) || []
            };
        } else {
            console.log("[DEBUG] Colors attribute not provided or missing in product.");
        }

        // Sizes attribute
        if (size_attribute_id && product.Attributes && product.Attributes.Sizes) {
            console.log("[DEBUG] Processing Sizes attribute.");
            attributeMapping.Sizes = {
                attribute_id: size_attribute_id,
                attribute_label: size_attribute_label,
                productValues: (product.Attributes.Sizes && product.Attributes.Sizes.Values) || []
            };
        } else {
            console.log("[DEBUG] Sizes attribute not provided or missing in product.");
        }

        // Materials attribute
        if (material_attribute_id && product.Attributes && product.Attributes.Materials) {
            console.log("[DEBUG] Processing Materials attribute.");
            attributeMapping.Materials = {
                attribute_id: material_attribute_id,
                attribute_label: material_attribute_label,
                productValues: (product.Attributes.Materials && product.Attributes.Materials.Values) || []
            };
        } else {
            console.log("[DEBUG] Materials attribute not provided or missing in product.");
        }

        // Shapes attribute
        if (shape_attribute_id && product.Attributes && product.Attributes.Shapes) {
            console.log("[DEBUG] Processing Shapes attribute.");
            attributeMapping.Shapes = {
                attribute_id: shape_attribute_id,
                attribute_label: shape_attribute_label,
                productValues: product.Attributes.Shapes.Values || []
            };
        } else {
            console.log("[DEBUG] Shapes attribute not provided or missing in product.");
        }

        // Process Quantity Prices
        if (quantity_attribute_id && product.Prices) {
            console.log("[DEBUG] Found product.Prices; processing quantity prices.");
            for (const obj of product.Prices) {
                console.log("[DEBUG] Processing price object:", obj);
                const quantityObject = {
                    quantity: obj.Quantity.From,
                    price: Math.round(obj.Cost * price_multiplier * 100) / 100
                };
                console.log("[DEBUG] Adding quantity object:", quantityObject);
                productQuantitiesPrice.push(quantityObject);
            }
        } else {
            console.log("[DEBUG] No direct product.Prices found; processing variants for quantity prices.");
            product.Variants.forEach(variant => {
                variant.Prices.forEach(obj => {
                    console.log("[DEBUG] Processing variant price object:", obj);
                    const quantityObject = {
                        quantity: obj.Quantity.From,
                        price: Math.round(obj.Cost * price_multiplier * 100) / 100
                    };
                    console.log("[DEBUG] Adding variant quantity object:", quantityObject);
                    productQuantitiesPrice.push(quantityObject);
                });
            });
        }

        // Process each attribute group (Colors, Sizes, Materials, Shapes)
        const finalResult = {};
        console.log("[DEBUG] Starting to iterate over attributeMapping keys:", Object.keys(attributeMapping));

        for (const [attrKey, data] of Object.entries(attributeMapping)) {
            console.log(`[DEBUG] Processing attribute group: ${attrKey} (ID: ${data.attribute_id})`);
            if (!data.attribute_id) {
                console.log(`[DEBUG] Attribute ID not provided for ${attrKey}`);
                finalResult[attrKey] = { error: 'Attribute ID not provided' };
                continue;
            }
            console.log(`[DEBUG] Fetching existing options for attribute ${attrKey} with ID: ${data.attribute_id}`);
            const existingOptions = await findAttributeOptions(data.attribute_id);
            console.log(`[DEBUG] Existing options for ${attrKey}:`, existingOptions);
            const additions = [];

            for (const option of data.productValues) {
                const optionName = replaceFractionsWithDecimals(option.Name);

                console.log(`[DEBUG] Checking option "${optionName}" for attribute ${attrKey}`);
                const optionExists = existingOptions.some(opt => opt.label === optionName);
                console.log(`[DEBUG] Does option "${optionName}" exist?`, optionExists);
                if (!optionExists) {
                    console.log(`[DEBUG] Option "${optionName}" not found. Adding new option.`);
                    const addResult = await addNewSingleOptionToTheAttribute(optionName, data.attribute_id);
                    console.log(`[DEBUG] Add result for "${optionName}":`, addResult);
                    additions.push({ optionName, added: true, addResult });
                }
            }
            finalResult[attrKey] = {
                attribute_id: data.attribute_id,
                attribute_label: data.attribute_label,
                existingOptions,
                additions
            };
            console.log(`[DEBUG] Completed processing for attribute group: ${attrKey}`);
        }

        // Process the Quantities attribute separately
        console.log("[DEBUG] Fetching existing quantity options for quantity attribute with ID:", quantity_attribute_id);
        const existingQuantityOptions = await findAttributeOptions(quantity_attribute_id);
        console.log("[DEBUG] Existing quantity options:", existingQuantityOptions);

        console.log("[DEBUG] Processing productQuantitiesPrice for quantity options.");
        for (const quantity of productQuantitiesPrice) {
            console.log(`[DEBUG] Processing quantity: ${quantity.quantity}, Price: ${quantity.price}`);
            const quantityExists = existingQuantityOptions.some(q => q.label.toString() === quantity.quantity.toString());
            console.log(`[DEBUG] Does quantity ${quantity.quantity} exist?`, quantityExists);
            if (!quantityExists) {
                console.log(`[DEBUG] Quantity ${quantity.quantity} not found. Adding it.`);
                const addResult = await addNewSingleOptionToTheAttribute(quantity.quantity, quantity_attribute_id);
                console.log(`[DEBUG] Added quantity option for ${quantity.quantity}:`, addResult);
                finalResult["Quantities"] = { added: true, addResult };
            }
        }

        // Fetch the prepared options for each attribute type
        console.log("[DEBUG] Fetching prepared options for each attribute type.");
        const preparedSizeOptions = await findAttributeOptions(size_attribute_id);
        const preparedColorOptions = await findAttributeOptions(color_attribute_id);
        const preparedMaterialOptions = await findAttributeOptions(material_attribute_id);
        const preparedShapeOptions = await findAttributeOptions(shape_attribute_id);
        const preparedQuantityOptions = await findAttributeOptions(quantity_attribute_id);

        // Initialize arrays to store used options
        const usedSizeOptions = [];
        const usedColorOptions = [];
        const usedMaterialOptions = [];
        const usedShapeOptions = [];
        const usedQuantityOptions = [];

        // Set quantity options for configuration
        console.log("[DEBUG] Setting quantity options for product configuration.");
        for (const obj of productQuantitiesPrice) {
            const option_value = preparedQuantityOptions.find(opt => opt.label.toString() === obj.quantity.toString());
            console.log(`[DEBUG] Setting quantity option: ${option_value ? option_value.label : 'not found'} for quantity ${obj.quantity}`);
            await setOptionOfConfigProductAttribute(
                quantity_attribute_id, quantity_attribute_label,
                option_value, printpronto_config_product_id, printpronto_config_product_sku, 5
            );
            usedQuantityOptions.push({
                label: replaceFractionsWithDecimals(option_value.label),
                value: option_value.value
            });
            console.log(`[DEBUG] Set quantity option for ${obj.quantity}`);
        }

        // Set color options if available
        if (product?.Attributes?.Colors?.Values) {
            console.log("[DEBUG] Setting color options for product configuration.");
            for (const obj of product.Attributes.Colors.Values) {
                try {
                    const option_value = preparedColorOptions.find(opt => opt.label.toString() === obj.Name.toString());
                    console.log(`[DEBUG] Setting color option: ${option_value ? option_value.label : 'not found'} for color ${obj.Name}`);
                    if (!option_value) {
                        console.error(`[DEBUG] Option for color "${obj.Name}" was not found in preparedColorOptions. Skipping this attribute option.`);
                        continue;
                    }
                    await setOptionOfConfigProductAttribute(
                        color_attribute_id, color_attribute_label,
                        option_value, printpronto_config_product_id, printpronto_config_product_sku
                    );
                    usedColorOptions.push({
                        label: option_value.label,
                        value: option_value.value
                    });
                    console.log(`[DEBUG] Set color option for ${obj.Name}`);
                } catch (error) {
                    console.error(`[DEBUG] Error setting color option for ${obj.Name}:`, error);
                    continue;
                }
            }
        }

        // Set size options if available
        if (product?.Attributes?.Sizes?.Values) {
            console.log("[DEBUG] Setting size options for product configuration.");
            console.log("[DEBUG] Product Sizes Values:", product.Attributes.Sizes.Values);
            console.log("[DEBUG] Prepared Size Options:", preparedSizeOptions);
            for (const obj of product.Attributes.Sizes.Values) {
                const cleanedName = replaceFractionsWithDecimals(obj.Name);

                const option_value = preparedSizeOptions.find(opt => opt.label.toString() === cleanedName);
                console.log(`[DEBUG] Setting size option: ${option_value ? option_value.label : 'not found'} for size ${cleanedName}`);
                
                await setOptionOfConfigProductAttribute(
                    size_attribute_id, size_attribute_label,
                    option_value, printpronto_config_product_id, printpronto_config_product_sku
                );
                if (!option_value) {
                    console.error(`[DEBUG] Option for "${cleanedName}" was not found in preparedSizeOptions. Skipping this attribute option.`);
                    continue;
                }
                usedSizeOptions.push({
                    label: replaceFractionsWithDecimals(option_value.label),
                    value: option_value.value
                });
                console.log(`[DEBUG] Set size option for ${cleanedName}`);
            }
        }

        // Set material options if available
        if (product?.Attributes?.Materials?.Values) {
            console.log("[DEBUG] Setting material options for product configuration.");
            for (const obj of product.Attributes.Materials.Values) {
                const option_value = preparedMaterialOptions.find(opt => opt.label.toString() === obj.Name.toString());
                console.log(`[DEBUG] Setting material option: ${option_value ? option_value.label : 'not found'} for material ${obj.Name}`);
                if (!option_value) {
                    console.error(`[DEBUG] Option for material "${obj.Name}" was not found in preparedMaterialOptions. Skipping this attribute option.`);
                    continue;
                }
                await setOptionOfConfigProductAttribute(
                    material_attribute_id, material_attribute_label,
                    option_value, printpronto_config_product_id, printpronto_config_product_sku
                );
                usedMaterialOptions.push({
                    label: option_value.label,
                    value: option_value.value
                });
                console.log(`[DEBUG] Set material option for ${obj.Name}`);
            }
        }

        // Set shape options if available
        if (product?.Attributes?.Shapes?.Values) {
            console.log("[DEBUG] Setting shape options for product configuration.");
            for (const obj of product.Attributes.Shapes.Values) {
                const option_value = preparedShapeOptions.find(opt => opt.label.toString() === obj.Name.toString());
                console.log(`[DEBUG] Setting shape option: ${option_value ? option_value.label : 'not found'} for shape ${obj.Name}`);
                if (!option_value) {
                    console.error(`[DEBUG] Option for shape "${obj.Name}" was not found in preparedShapeOptions. Skipping this attribute option.`);
                    continue;
                }
                await setOptionOfConfigProductAttribute(
                    shape_attribute_id, shape_attribute_label,
                    option_value, printpronto_config_product_id, printpronto_config_product_sku
                );
                usedShapeOptions.push({
                    label: option_value.label,
                    value: option_value.value
                });
                console.log(`[DEBUG] Set shape option for ${obj.Name}`);
            }
        }

        console.log("[DEBUG] Final used options for each attribute type:");
        console.log("[DEBUG] Used Size Options:", usedSizeOptions);
        console.log("[DEBUG] Used Color Options:", usedColorOptions);
        console.log("[DEBUG] Used Material Options:", usedMaterialOptions);
        console.log("[DEBUG] Used Shape Options:", usedShapeOptions);
        console.log("[DEBUG] Used Quantity Options:", usedQuantityOptions);

        const safeQuantityOptions = usedQuantityOptions.length ? usedQuantityOptions : [{ label: '', value: '' }];
        const safeSizeOptions = usedSizeOptions.length ? usedSizeOptions : [{ label: '', value: '' }];
        const safeShapeOptions = usedShapeOptions.length ? usedShapeOptions : [{ label: '', value: '' }];
        const safeColorOptions = usedColorOptions.length ? usedColorOptions : [{ label: '', value: '' }];
        const safeMaterialOptions = usedMaterialOptions.length ? usedMaterialOptions : [{ label: '', value: '' }];

        // Create configurable product combinations via nested loops
        console.log("[DEBUG] Starting to create simple products for every combination of options.");
        for (const qtyOption of safeQuantityOptions) {
            for (const sizeOption of safeSizeOptions) {
                for (const shapeOption of safeShapeOptions) {
                    for (const colorOption of safeColorOptions) {
                        for (const materialOption of safeMaterialOptions) {
                            let currentQuantityPrice = productQuantitiesPrice.find(q =>
                                q.quantity.toString() === qtyOption.label.toString()
                            )?.price || 0;
                            const combinationName = `${product.Name} Q:${qtyOption.label} S:${sizeOption.label} Sh:${shapeOption.label} C:${colorOption.label} M:${materialOption.label}`;
                            console.log(`[DEBUG] Creating product for combination: ${combinationName} with price: ${currentQuantityPrice}`);
                            console.log("Size Option Example:  ", sizeOption);
                            const custom_attributes = [];

                            currentQuantityPrice = Number((Math.round(currentQuantityPrice * Number(qtyOption.label) * 100) / 100).toFixed(2));

                            if (sizeOption.value) {
                                custom_attributes.push({ attribute_code: size_attribute_label, value: sizeOption.value });
                            }
                            if (colorOption.value) {
                                custom_attributes.push({ attribute_code: color_attribute_label, value: colorOption.value });
                            }
                            if (shapeOption.value) {
                                custom_attributes.push({ attribute_code: shape_attribute_label, value: shapeOption.value });
                            }
                            if (materialOption.value) {
                                custom_attributes.push({ attribute_code: material_attribute_label, value: materialOption.value });
                            }
                            if (qtyOption.value) {
                                custom_attributes.push({ attribute_code: quantity_attribute_label, value: qtyOption.value });
                            }
                            console.log("[DEBUG] Custom attributes for combination:", custom_attributes);
                            const simpleProductSku = await createSimpleProduct(
                                printpronto_config_product_id,
                                combinationName,
                                attribute_set_id,
                                qtyOption.label,
                                currentQuantityPrice,
                                custom_attributes
                            );
                            console.log(`[DEBUG] Created simple product SKU: ${simpleProductSku} for combination: ${combinationName}`);
                            await assignSimpleProductToConfigurable(simpleProductSku, printpronto_config_product_sku);
                            console.log(`[DEBUG] Assigned simple product SKU: ${simpleProductSku} to configurable product with SKU: ${printpronto_config_product_sku}`);
                        }
                    }
                }
            }
        }
        // console.log("[DEBUG] Final result object:", finalResult);
        // console.log("[DEBUG] processProduct function completed.");

        
        // Add thumbnail picture to the product
        if (product.ImageUrl) {
            await addImageToProduct(product.ImageUrl, product.Name, 1, printpronto_config_product_sku, true)
        }
        // Add non-thumbnail picture to the product (if there are)
        if (product.Images && product.Images.length > 1) {
            console.log("[DEBUG] Adding additional images to the product.");
        
            for (const [index, imageUrl] of product.Images.slice(1).entries()) {
                await addImageToProduct(imageUrl, product.Name, index + 1, printpronto_config_product_sku, false)
            }
        }
        console.log("[DEBUG] All images added to the product.");
    } catch (error) {
        console.error("[ERROR] Error processing attribute options:", error);
    }
}




module.exports = {
    fetchProduct,
    createConfigurableProduct,
    findAttributeOptions,
    addNewOptionsToTheAttribute,
    addNewSingleOptionToTheAttribute,
    setOptionOfConfigProductAttribute,
    createSimpleProduct,
    assignSimpleProductToConfigurable,
    cleanLabel,
    addImageToProduct,
    processProduct
};
