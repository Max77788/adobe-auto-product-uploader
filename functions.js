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

function cleanLabel(label) {
    return label.replace(/"/g, '').trim();
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
    cleanLabel
};
