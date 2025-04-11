const express = require('express');
const dotenv = require('dotenv');
const { fetchProduct,
    setOptionOfConfigProductAttribute,
    createSimpleProduct,
    assignSimpleProductToConfigurable
 } = require('./functions.js');
const { v4: uuidv4 } = require('uuid');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const PRINTPRONTO_API_BASE_URL = "https://printpronto.com/rest/default/V1";

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

// Route to handle attribute option requests
app.post('/process-product', async (req, res) => {
    try {
        // Destructure the new payload keys from req.body
        const {
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

        // Fetch the product using the provided esp_product_id
        const product = await fetchProduct(esp_product_id);

        // Prepare a mapping for each attribute type with its corresponding payload data
        // and the product's attribute list.
        const attributeMapping = {};

        const productQuantitiesPrice = [];

        // Colors attribute
        if (color_attribute_id && product.Attributes && product.Attributes.Colors) {
            attributeMapping.Colors = {
                attribute_id: color_attribute_id,
                attribute_label: color_attribute_label,
                productValues: (product.Attributes && product.Attributes.Colors && product.Attributes.Colors.Values) || []
            };
        }

        // Sizes attribute
        if (size_attribute_id && product.Attributes && product.Attributes.Sizes) {
            attributeMapping.Sizes = {
                attribute_id: size_attribute_id,
                attribute_label: size_attribute_label,
                productValues: (product.Attributes && product.Attributes.Sizes && product.Attributes.Sizes.Values) || []
            };
        }

        // Materials attribute (if provided and exists on the product)
        if (material_attribute_id && product.Attributes && product.Attributes.Materials) {
            attributeMapping.Materials = {
                attribute_id: material_attribute_id,
                attribute_label: material_attribute_label,
                productValues: (product.Attributes && product.Attributes.Materials && product.Attributes.Materials.Values) || []
            };
        }

        // Shapes attribute (if provided and exists on the product)
        if (shape_attribute_id && product.Attributes && product.Attributes.Shapes) {
            attributeMapping.Shapes = {
                attribute_id: shape_attribute_id,
                attribute_label: shape_attribute_label,
                productValues: product.Attributes.Shapes.Values || []
            };
        }

        if (quantity_attribute_id && product.Prices) {
            
            for (const obj of product.Prices) {
                const quantityObject = {
                    quantity: obj.Quantity.From,
                    price: round(obj.Cost * price_multiplier, 2)
                };

                productQuantitiesPrice.push(quantityObject);
            }
            
        } else {
            
            product.Variants.forEach(variant => {
                variant.Prices.forEach(obj => {
                    const quantityObject = {
                        quantity: obj.Quantity.From,
                        price: round(obj.Cost * price_multiplier, 2)
                    };

                    productQuantitiesPrice.push(quantityObject);
                })
            });
        }
        // Object to accumulate results for each attribute type
        const finalResult = {};

        // Iterate over each attribute group (Colors, Sizes, Materials, Shapes)
        for (const [attrKey, data] of Object.entries(attributeMapping)) {
            if (!data.attribute_id) {
                finalResult[attrKey] = { error: 'Attribute ID not provided' };
                continue;
            }

            // Fetch the current attribute options from the database
            const existingOptions = await findAttributeOptions(data.attribute_id);
            const additions = [];

            // Loop over each value from the product's attribute list
            for (const option of data.productValues) {
                // Each value is expected to have a "Name" property
                const optionName = option.Name;

                // Check if any of the existing options' labels contain this optionName.
                // You can adjust the check (e.g., case-insensitive, exact match) as needed.
                const optionExists = existingOptions.some(opt => opt.label.includes(optionName));
                if (!optionExists) {
                    // Option not found, so add it using the provided function
                    const addResult = await addNewSingleOptionToTheAttribute(optionName, data.attribute_id);
                    additions.push({ optionName, added: true, addResult });
                }
            }

            finalResult[attrKey] = {
                attribute_id: data.attribute_id,
                attribute_label: data.attribute_label,
                existingOptions,
                additions
            };
        }

        const existingQuantityOptions = await findAttributeOptions(data.attribute_id);

        // Iterate Over Quantities attribute
        for (const quantity of productQuantitiesPrice) {
            const quantityExists = existingQuantityOptions.some(q => q.label.toString() === quantity.quantity.toString());
            if (!quantityExists) {
                const addResult = await addNewSingleOptionToTheAttribute(quantity.quantity, quantity_attribute_id);
                finalResult["Quantities"] = { added: true, addResult };
            }
        }


        const preparedSizeOptions = await findAttributeOptions(size_attribute_id);
        const preparedColorOptions = await findAttributeOptions(color_attribute_id);
        const preparedMaterialOptions = await findAttributeOptions(material_attribute_id);
        const preparedShapeOptions = await findAttributeOptions(shape_attribute_id);
        const preparedQuantityOptions = await findAttributeOptions(quantity_attribute_id);


        for (const obj of productQuantitiesPrice) {
            const option_value = preparedQuantityOptions.find(opt => opt.label.toString() === obj.quantity.toString());
            
            await setOptionOfConfigProductAttribute(
                quantity_attribute_id, quantity_attribute_label,
                option_value, printpronto_config_product_id, 5
            );
        }

        if (product.Attributes.Colors.Values) {
            for (const obj of product.Attributes.Colors.Values) {
                const option_value = preparedQuantityOptions.find(opt => opt.label.toString() === obj.Name.toString());
            
                await setOptionOfConfigProductAttribute(
                    color_attribute_id, color_attribute_label,
                    option_value, printpronto_config_product_id
                );
            }
        }

        if (product.Attributes.Sizes.Values) {
            for (const obj of product.Attributes.Sizes.Values) {
                const option_value = preparedSizeOptions.find(opt => opt.label.toString() === obj.Name.toString());

                await setOptionOfConfigProductAttribute(
                    size_attribute_id, size_attribute_label,
                    option_value, printpronto_config_product_id
                );
            }
        }

        if (product.Attributes.Materials.Values) {
            for (const obj of product.Attributes.Materials.Values) {
                const option_value = preparedMaterialOptions.find(opt => opt.label.toString() === obj.Name.toString());

                await setOptionOfConfigProductAttribute(
                    material_attribute_id, material_attribute_label,
                    option_value, printpronto_config_product_id
                );
            }
        }

        if (product.Attributes.Shapes.Values) {
            for (const obj of product.Attributes.Shapes.Values) {
                const option_value = preparedShapeOptions.find(opt => opt.label.toString() === obj.Name.toString());

                await setOptionOfConfigProductAttribute(
                    shape_attribute_id, shape_attribute_label,
                    option_value, printpronto_config_product_id
                );
            }
        }


        for (const qtyOption of preparedQuantityOptions) {
            for (const sizeOption of preparedSizeOptions) {
                for (const shapeOption of preparedShapeOptions) {
                    for (const colorOption of preparedColorOptions) {
                        for (const materialOption of preparedMaterialOptions) {
                            // Look up the price for the current quantity option.
                            const currentQuantityPrice = productQuantitiesPrice.find(q => q.quantity.toString() === qtyOption.label.toString())?.price || 0;

                            // Build a product name combining the base name and the option values.
                            const combinationName = `${product.Name} Q:${qtyOption.label} S:${sizeOption.label} Sh:${shapeOption.label} C:${colorOption.label} M:${materialOption.label}`;

                            const custom_attributes = [
                                { attribute_code: size_attribute_label, value: sizeOption.value },
                                { attribute_code: color_attribute_label, value: colorOption.value },
                                { attribute_code: shape_attribute_label, value: shapeOption.value },
                                { attribute_code: material_attribute_label, value: materialOption.value },
                                { attribute_code: quantity_attribute_label, value: qtyOption.value }
                            ];
                            
                            // Call the product creation function passing the appropriate parameters.
                            const simpleProductSku = await createSimpleProduct(
                                printpronto_config_product_id,
                                combinationName,
                                attribute_set_id, // Ensure attribute_set_id is available
                                qtyOption.label,
                                currentQuantityPrice,
                                custom_attributes
                            );

                            await assignSimpleProductToConfigurable(simpleProductSku, printpronto_config_product_sku)
                        }
                    }
                }
            }
        }


        // Return the final response including product config and attribute update details
        res.json({
            success: true,
            message: 'Attribute options processed successfully',
        });
    } catch (error) {
        console.error("Error processing attribute options:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});