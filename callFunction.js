require("dotenv").config();
const { ethers } = require("ethers");
const fs = require('fs');
const path = require('path');

// Load your Alchemy API URL and private key from environment variables
const ALCHEMY_API_URL = process.env.ALCHEMY_API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Replace with your contract's ABI and address
const contractData = require('./myFlash.json'); // Load the ABI
const contractABI = Array.isArray(contractData) ? contractData : contractData.abi; // Ensure we access the right property
const contractAddress = "0x9EeaDf27efaA9e90cf37347C57e6bdcBe9E99090"; // Replace with your actual contract address

// Define the FlashParams object
const FlashParams = {
    token: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    pairtoken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    amount: ethers.utils.parseEther("3"), // starting value
    usePath: 0,
    path1: 5,
    path2: 6
};

const FlashParams1 = {
    token: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    pairtoken: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    amount: ethers.utils.parseUnits("8000", 6), // starting value
    usePath: 0,
    path1: 5,
    path2: 6
};

// Log file path
const logFilePath = path.join(__dirname, 'transaction_logs.txt');

// Helper function to log the message with timestamp in Japan Time Zone and run number
let runNumber = 0;
function logToFile(message) {
    const timestamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false });
    const preciseTime = new Date().toISOString().split('T')[1]; // Get time with sub-seconds (HH:mm:ss.sss)
    runNumber++;
    const logMessage = `[Run ${runNumber}] ${timestamp} (${preciseTime}): ${message}\n`;
    fs.appendFileSync(logFilePath, logMessage);
}

async function simulateFlashCall(contract, FlashParams) {
    try {
        // Simulate the flash call with callStatic to avoid gas usage
        const result = await contract.callStatic.callFlash(FlashParams);
        logToFile("Transaction simulation succeeded.");
        
        // If simulation succeeds, call the actual transaction
        try {
            const tx = await contract.callFlash(FlashParams);
            logToFile(`Transaction sent: ${tx.hash}`);
            
            // Wait for transaction confirmation
            const receipt = await tx.wait();
            logToFile(`Transaction confirmed: ${receipt.transactionHash}`);
        } catch (txError) {
            logToFile(`Transaction failed: ${txError.message}`);
        }
        
    } catch (error) {
        console.log("transaction simulation was failed");
        logToFile(`Transaction simulation failed or error: ${error.message}`);
    }
}

async function main() {
    // Set up provider and wallet
    const provider = new ethers.providers.WebSocketProvider(ALCHEMY_API_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(contractAddress, contractABI, wallet);

    console.log("Contract instance created");
    logToFile("Contract instance created");

    // Define how many times to call in parallel
    const totalCalls = 100; // Total number of calls
    const period = 10; // Period in milliseconds (0.001 seconds)
    const halfCalls = totalCalls / 2; // Half for each parameter

    // Infinite loop
    while (true) {
        const promises = [];
        
        // Alternate calls for FlashParams and FlashParams1
        for (let i = 0; i < halfCalls; i++) {
            promises.push(simulateFlashCall(contract, FlashParams));
            await new Promise(resolve => setTimeout(resolve, period)); // Wait for 1 millisecond

            promises.push(simulateFlashCall(contract, FlashParams1));
            await new Promise(resolve => setTimeout(resolve, period)); // Wait for 1 millisecond
        }

        // Wait for all promises to complete
        await Promise.all(promises);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        logToFile(`Fatal error: ${error}`);
        process.exit(1);
    });
