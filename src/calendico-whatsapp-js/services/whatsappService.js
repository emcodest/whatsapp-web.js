const { Client, RemoteAuth } = require('./../../../index.js');
const SQLiteStore = require('./databaseService');
const qrcodeTerminal = require('qrcode-terminal');
const { addClient } = require('./../clients/ClientsConnected');
const axios = require('axios');

const initializeWhatsAppClient = async (location_identifier, user_id) => {
    console.log(`Initializing WhatsApp client for ${location_identifier} by user ${user_id}...`);

    // Create an instance of SQLiteStore for the session
    const store = new SQLiteStore(location_identifier);

    try {
        // Ensure the database is initialized before creating the client
        await store.initializeDatabase();

        const client = new Client({
            authStrategy: new RemoteAuth({
                store: store,
                clientId: location_identifier,
                backupSyncIntervalMs: 5 * (60 * 1000) // Optional: Sync interval in milliseconds
            })
        });

        // Setup event listeners for the client
        setupClientEventListeners(client, location_identifier, user_id);

        // Initialize the client
        client.initialize();

        // Store the client instance in the clients object
        addClient(location_identifier, client);

    } catch (error) {
        console.error(`Failed to initialize WhatsApp client for ${location_identifier}:`, error);
    }
};

const setupClientEventListeners = (client, location_identifier, user_id) => {
    client.on('qr', async (qr) => {
        // Send QR code to Rails app instead of logging it
        console.log(`QR code for ${location_identifier}:`, qr);
        console.log('----------------------------------------------------------------------------------------------');
        console.log(`location_identifier: ${location_identifier}, user_id: ${user_id}`);
        console.log('----------------------------------------------------------------------------------------------');
        try {
            console.log('----------------------------------------------------------------------------------------------');
            qrcodeTerminal.generate(qr, { small: true });
            console.log('----------------------------------------------------------------------------------------------');
            console.log('sending qr code to rails app');
            await axios.post('http://localhost:3000/whatsapp_web/qr_code', {
                code: qr,
                location_identifier: location_identifier,
                user_id: user_id
            });
        } catch (error) {
            console.error(`Failed to send QR code for ${location_identifier}:`, error);
        }
    });

    client.on('remote_session_saved', () => {
        console.log('----------------------------------------------------------------------------------------------');
        console.log('remote_session_saved for session:', location_identifier);
        console.log('----------------------------------------------------------------------------------------------');
    });



    client.on('authenticated', () => {
        // Save the new session data to the database
        console.log('1----------------------------------------------------------------------------------------------');
        console.info('Starting to save session for location:', location_identifier);
        console.info('This can take up to a minute depending on the size of the session data, so please wait.');
        console.log('1----------------------------------------------------------------------------------------------');
    });

    client.on('auth_failure', msg => {
        // Fired if session restore was unsuccessful
        console.log('1----------------------------------------------------------------------------------------------');
        console.error('AUTHENTICATION FAILURE: ', msg);
        console.log('2----------------------------------------------------------------------------------------------');
    });

    client.on('ready', async () => {
        console.log('1----------------------------------------------------------------------------------------------');
        console.log(`WhatsApp client is ready for ${location_identifier}!`);
        const client_number = client.info.wid.user;
        const client_platform = client.info.platform;
        const client_pushname = client.info.pushname;
        await axios.post('http://localhost:3000/whatsapp_js/new_login', {
            event_type: 'success',
            user_id: user_id,
            phone: client_number,
            location_identifier: location_identifier,
            client_platform: client_platform,
            client_pushname: client_pushname
        }).catch(error => {
            console.error('Error sending ready event to rails app:', error);
        });
        console.log('2----------------------------------------------------------------------------------------------');
    });

    // Handle other necessary events like 'message', 'disconnected', etc.
    client.on('message', (message) => {
        processMessage(message).catch(error => {
            console.error('Error in processMessage:', error);
        });
    });

    client.on('disconnected', (reason) => {
        console.log('1----------------------------------------------------------------------------------------------');
        console.log('Client was logged out: ', reason);
        console.log('2----------------------------------------------------------------------------------------------');
        // send logout event to rails app
    });
};

async function processMessage(message) {
    console.log('1----------------------------------------------------------------------------------------------');
    console.log('These are all the properties of the message object:');
    printTree(message);
    console.log('-------------------------------------------------------');
    console.log('Message body: ', message.body);
    console.log('Message from: ', message.from);
    console.log('Message author: ', message.author);
    console.log('Message to: ', message.to);
    console.log('Message type: ', message.type);
    console.log('Message deviceType: ', message.deviceType);
    console.log('Message fromMe: ', message.fromMe);

    try {
        const chat = await message.getChat();
        console.log('Message is group: ', chat.isGroup);
    } catch (error) {
        console.error('Error obtaining chat:', error);
    }
    console.log('2----------------------------------------------------------------------------------------------');
}

function printTree(obj, depth = 0) {
    const indent = '_'.repeat(depth * 4); // Increase indent for each level of depth
    Object.keys(obj).forEach(key => {
        const value = obj[key];

        // Check if value is an object and not null, and recursively call printTree
        if (typeof value === 'object' && value !== null) {
            console.log(`| ${indent}${key}:`);
            printTree(value, depth + 1);
        } else {
            console.log(`| ${indent}${key}: ${value}`);
        }
    });
}

module.exports = { initializeWhatsAppClient };
