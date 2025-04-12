const express = require('express');
const dotenv = require('dotenv');
const { fetchProduct,
    setOptionOfConfigProductAttribute,
    createSimpleProduct,
    assignSimpleProductToConfigurable,
    addNewSingleOptionToTheAttribute,
    findAttributeOptions,
    processProduct,
    addImageToProduct,
    cleanLabel
 } = require('./functions.js');
const { v4: uuidv4 } = require('uuid');

const serverless = require('serverless-http');

const bodyParser = require('body-parser');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const PRINTPRONTO_API_BASE_URL = "https://printpronto.com/rest/default/V1";


app.get('/', (req, res) => {
    res.send('Hello from the serverless function!');
});


// Route to handle attribute option requests
app.post('/process-product', async (req, res) => {
    console.log("[DEBUG] '/process-product' route triggered.");
    console.log("[DEBUG] Request body received:", req);

    try {
        // Destructure the new payload keys from req.body
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

        // Prepare a mapping for each attribute type with its corresponding payload data
        // and the product's attribute list.
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

        // Materials attribute (if provided and exists on the product)
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

        // Shapes attribute (if provided and exists on the product)
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

        // Quantity prices
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

        // Object to accumulate results for each attribute type
        const finalResult = {};
        console.log("[DEBUG] Starting to iterate over attributeMapping keys:", Object.keys(attributeMapping));

        // Iterate over each attribute group (Colors, Sizes, Materials, Shapes)
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

            // Loop over each value from the product's attribute list
            for (const option of data.productValues) {
                // Each value is expected to have a "Name" property
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

        // Fetch existing quantity options using quantity_attribute_id
        console.log("[DEBUG] Fetching existing quantity options for quantity attribute with ID:", quantity_attribute_id);
        const existingQuantityOptions = await findAttributeOptions(quantity_attribute_id);
        console.log("[DEBUG] Existing quantity options:", existingQuantityOptions);

        // Iterate Over Quantities attribute
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

        // Fetch prepared options for each attribute type
        console.log("[DEBUG] Fetching prepared options for each attribute type.");
        const preparedSizeOptions = await findAttributeOptions(size_attribute_id);
        const preparedColorOptions = await findAttributeOptions(color_attribute_id);
        const preparedMaterialOptions = await findAttributeOptions(material_attribute_id);
        const preparedShapeOptions = await findAttributeOptions(shape_attribute_id);
        const preparedQuantityOptions = await findAttributeOptions(quantity_attribute_id);
        
        /*
        console.log("[DEBUG] Prepared size options:", preparedSizeOptions);
        console.log("[DEBUG] Prepared color options:", preparedColorOptions);
        console.log("[DEBUG] Prepared material options:", preparedMaterialOptions);
        console.log("[DEBUG] Prepared shape options:", preparedShapeOptions);
        console.log("[DEBUG] Prepared quantity options:", preparedQuantityOptions);
        */

        const usedSizeOptions = [];
        const usedColorOptions = [];
        const usedMaterialOptions = [];
        const usedShapeOptions = [];
        const usedQuantityOptions = [];
        
        // Set quantity option for configuration
        console.log("[DEBUG] Setting quantity options for product configuration.");
        for (const obj of productQuantitiesPrice) {
            const option_value = preparedQuantityOptions.find(opt => opt.label.toString() === obj.quantity.toString());
            console.log(`[DEBUG] Setting quantity option: ${option_value ? option_value.label : 'not found'} for quantity ${obj.quantity}`);

            await setOptionOfConfigProductAttribute(
                quantity_attribute_id, quantity_attribute_label,
                option_value, printpronto_config_product_id, 5
            );

            const obj_ = {
                label: option_value.label,
                value: option_value.value
            }

            usedQuantityOptions.push(obj_);
            console.log(`[DEBUG] Set quantity option for ${obj.quantity}`);
        }

        // Set color options if available
        if (product.Attributes.Colors.Values) {
            console.log("[DEBUG] Setting color options for product configuration.");
            for (const obj of product.Attributes.Colors.Values) {
                try {
                    const option_value = preparedQuantityOptions.find(opt => opt.label.toString() === obj.Name.toString());
                    console.log(`[DEBUG] Setting color option: ${option_value ? option_value.label : 'not found'} for color ${obj.Name}`);
                    
                    if (!option_value) {
                        console.error(`[DEBUG] Option for "${option_value.label}" was not found in preparedSizeOptions. Skipping this attribute option.`);
                        continue; // or handle it as needed
                    }
                    
                    await setOptionOfConfigProductAttribute(
                        color_attribute_id, color_attribute_label,
                        option_value, printpronto_config_product_id
                    );

                    const obj_ = {
                        label: option_value.label,
                        value: option_value.value
                    }

                    usedColorOptions.push(obj_);
                    console.log(`[DEBUG] Set color option for ${obj.Name}`);
                } catch (error) {
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
                // const cleanedName = cleanLabel(obj.Name);
                const cleanedName = obj.Name;
                
                const option_value = preparedSizeOptions.find(opt => opt.label.toString() === cleanedName);
                console.log(`[DEBUG] Setting size option: ${option_value ? option_value.label : 'not found'} for size ${cleanedName}`);
                await setOptionOfConfigProductAttribute(
                    size_attribute_id, size_attribute_label,
                    option_value, printpronto_config_product_id
                );

                if (!option_value) {
                    console.error(`[DEBUG] Option for "${option_value.label}" was not found in preparedSizeOptions. Skipping this attribute option.`);
                    continue; // or handle it as needed
                }

                if (option_value) {
                    const obj_ = {
                        label: option_value.label,
                        value: option_value.value
                    }

                    usedSizeOptions.push(obj_);
                    console.log(`[DEBUG] Set size option for ${cleanedName}`);
                } else {
                    console.log(`[DEBUG] Option for "${cleanedName}" was not found in preparedSizeOptions.`);
                }
            }
        }

        // Set material options if available
        if (product.Attributes.Materials.Values) {
            console.log("[DEBUG] Setting material options for product configuration.");
            for (const obj of product.Attributes.Materials.Values) {
                const option_value = preparedMaterialOptions.find(opt => opt.label.toString() === obj.Name.toString());
                console.log(`[DEBUG] Setting material option: ${option_value ? option_value.label : 'not found'} for material ${obj.Name}`);
                
                if (!option_value) {
                    console.error(`[DEBUG] Option for "${option_value.label}" was not found in preparedSizeOptions. Skipping this attribute option.`);
                    continue; // or handle it as needed
                }
                
                await setOptionOfConfigProductAttribute(
                    material_attribute_id, material_attribute_label,
                    option_value, printpronto_config_product_id
                );

                

                const obj_ = {
                    label: option_value.label,
                    value: option_value.value
                }

                usedMaterialOptions.push(obj_);
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
                    console.error(`[DEBUG] Option for "${option_value.label}" was not found in preparedSizeOptions. Skipping this attribute option.`);
                    continue; // or handle it as needed
                }
                
                await setOptionOfConfigProductAttribute(
                    shape_attribute_id, shape_attribute_label,
                    option_value, printpronto_config_product_id
                );

                const obj_ = {
                    label: option_value.label,
                    value: option_value.value
                }

                usedShapeOptions.push(obj_);
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


        // Create combinations of attribute options to form the configurable product
        console.log("[DEBUG] Starting to create simple products for every combination of options.");
        for (const qtyOption of safeQuantityOptions) {
            for (const sizeOption of safeSizeOptions) {
                for (const shapeOption of safeShapeOptions) {
                    for (const colorOption of safeColorOptions) {
                        for (const materialOption of safeMaterialOptions) {
                            const currentQuantityPrice = productQuantitiesPrice.find(q => q.quantity.toString() === qtyOption.label.toString())?.price || 0;
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

                            // Call the product creation function
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

        // Return the final response including product config and attribute update details
        res.json({
            success: true,
            message: 'Attribute options processed successfully',
        });
        console.log("[DEBUG] Process completed successfully, response sent.");
    } catch (error) {
        console.error("[ERROR] Error processing attribute options:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/process-product-new', (req, res) => {
    console.log("[DEBUG] '/process-product-new' route triggered.");
    console.log("[DEBUG] Request body received:", req.body);

    // Fire off the background processing function without awaiting its result
    processProduct(req);

    // Immediately return the response to the client
    res.json({
        success: true,
        message: 'Attribute options processing initiated in background.'
    });
});

app.post('/add-images', async (req, res) => {
    // Destructure the new payload keys from req.body
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

    const product = await fetchProduct(esp_product_id);

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

    // Immediately return the response to the client
    res.json({
        success: true,
        message: 'Attribute options processing initiated in background.'
    });
});

app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
});

// Export the wrapped Express application
module.exports = app;