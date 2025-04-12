const dotenv = require('dotenv');
dotenv.config();
const { v4: uuidv4 } = require('uuid');

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


 async function setOptionOfConfigProductAttribute(attribute_id, attribute_label, option_value, config_product_id, position=0) {
    
    const newOption = {
        "option": {
            "attribute_id": `${attribute_id}`,
            "label": `${attribute_label}`,
            "position": position,
            "values": [
                {
                    "value_index": `${option_value}`,
                }
            ],
            "product_id": `${config_product_id}`,
        }
    }
};

async function createSimpleProduct(config_product_id, config_product_name, attribute_set_id, quantity, quantity_price, custom_attributes) {
    const uniqueId = uuidv4().substring(0, 4);
    
    const productSku = `${config_product_id}-${config_product_name.replace(/"/g, "").replace(/ /g, "")}-${uniqueId}`;

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
                    qty: 100000,
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
    
    // Optionally, you might want to handle and return the response.
    return productSku;
}

async function assignSimpleProductToConfigurable(child_product_sku, config_product_sku) {
    const payload = {
        "childSku": child_product_sku,
    }
    
    const response = await fetch(`${process.env.PRINTPRONTO_API_BASE_URL}/rest/default/V1/configurable-products/${config_product_sku}/child`, {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${process.env.PRINTPRONTO_API_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
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


async function addImageToProduct(imageUrl, productName, isThumbnail = false) {
    
    const image_link = `https://api.asicentral.com/v1/${imageUrl}`
    
    const payload_thumbnail = {
        "entry": {
            "media_type": "image",
            "label": `${productName.replace(" ", "_")}-image-${uuidv4().substring(0, 4)}`,
            "position" : 1,
            "disabled": false,
            "types": ["thumbnail", "image", "small_image"],
            "file": "",
            "content": {
                "base64_encoded_data": "",
                "type": "image/jpeg",
                "name": ""
            }
        }
    }
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
                const optionName = option.Name;
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
                option_value, printpronto_config_product_id, 5
            );
            usedQuantityOptions.push({
                label: option_value.label,
                value: option_value.value
            });
            console.log(`[DEBUG] Set quantity option for ${obj.quantity}`);
        }

        // Set color options if available
        if (product.Attributes.Colors.Values) {
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
                        option_value, printpronto_config_product_id
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
        if (product.Attributes.Sizes.Values) {
            console.log("[DEBUG] Setting size options for product configuration.");
            console.log("[DEBUG] Product Sizes Values:", product.Attributes.Sizes.Values);
            console.log("[DEBUG] Prepared Size Options:", preparedSizeOptions);
            for (const obj of product.Attributes.Sizes.Values) {
                const cleanedName = obj.Name;
                const option_value = preparedSizeOptions.find(opt => opt.label.toString() === cleanedName);
                console.log(`[DEBUG] Setting size option: ${option_value ? option_value.label : 'not found'} for size ${cleanedName}`);
                await setOptionOfConfigProductAttribute(
                    size_attribute_id, size_attribute_label,
                    option_value, printpronto_config_product_id
                );
                if (!option_value) {
                    console.error(`[DEBUG] Option for "${cleanedName}" was not found in preparedSizeOptions. Skipping this attribute option.`);
                    continue;
                }
                usedSizeOptions.push({
                    label: option_value.label,
                    value: option_value.value
                });
                console.log(`[DEBUG] Set size option for ${cleanedName}`);
            }
        }

        // Set material options if available
        if (product.Attributes.Materials.Values) {
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
                    option_value, printpronto_config_product_id
                );
                usedMaterialOptions.push({
                    label: option_value.label,
                    value: option_value.value
                });
                console.log(`[DEBUG] Set material option for ${obj.Name}`);
            }
        }

        // Set shape options if available
        if (product.Attributes.Shapes.Values) {
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
                    option_value, printpronto_config_product_id
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
                            const currentQuantityPrice = productQuantitiesPrice.find(q =>
                                q.quantity.toString() === qtyOption.label.toString()
                            )?.price || 0;
                            const combinationName = `${product.Name} Q:${qtyOption.label} S:${sizeOption.label} Sh:${shapeOption.label} C:${colorOption.label} M:${materialOption.label}`;
                            console.log(`[DEBUG] Creating product for combination: ${combinationName} with price: ${currentQuantityPrice}`);
                            console.log("Size Option Example:  ", sizeOption);
                            const custom_attributes = [
                                { attribute_code: size_attribute_label, value: sizeOption.value },
                                { attribute_code: color_attribute_label, value: colorOption.value },
                                { attribute_code: shape_attribute_label, value: shapeOption.value },
                                { attribute_code: material_attribute_label, value: materialOption.value },
                                { attribute_code: quantity_attribute_label, value: qtyOption.value }
                            ];
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
        console.log("[DEBUG] Final result object:", finalResult);
        console.log("[DEBUG] processProduct function completed.");
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
    processProduct
};
