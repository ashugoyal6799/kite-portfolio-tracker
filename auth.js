#!/usr/bin/env node

const axios = require("axios");
const readline = require("readline");
const crypto = require("crypto");
const fs = require("fs");
require("dotenv").config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function authenticate() {
  try {
    const apiKey = process.env.KITE_API_KEY;
    const apiSecret = process.env.KITE_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.log(
        "❌ Please add KITE_API_KEY and KITE_API_SECRET to your .env file"
      );
      return;
    }

    console.log("🔐 Kite Connect Authentication\n");

    // Step 1: Generate login URL
    const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${apiKey}`;
    console.log("📱 Open this URL in your browser:");
    console.log(`\n${loginUrl}\n`);

    console.log("📋 Steps:");
    console.log("1. Login with your Zerodha credentials");
    console.log("2. Complete 2FA if prompted");
    console.log("3. Copy the callback URL and paste it below\n");

    // Step 2: Get callback URL
    const callbackUrl = await question("Paste the callback URL: ");

    // Step 3: Extract request token
    const url = new URL(callbackUrl);
    const requestToken = url.searchParams.get("request_token");

    if (!requestToken) {
      throw new Error("Request token not found in callback URL");
    }

    console.log(`✅ Request token: ${requestToken}`);

    // Step 4: Generate checksum
    const checksum = crypto
      .createHash("sha256")
      .update(`${apiKey}${requestToken}${apiSecret}`)
      .digest("hex");

    // Step 5: Get access token
    console.log("🔄 Generating access token...");

    const response = await axios.post(
      "https://api.kite.trade/session/token",
      {
        api_key: apiKey,
        request_token: requestToken,
        checksum: checksum,
      },
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const accessToken = response.data.data.access_token;
    const refreshToken = response.data.data.refresh_token || "";
    console.log(`✅ Access token: ${accessToken}`);

    if (refreshToken) {
      console.log(`✅ Refresh token: ${refreshToken}`);
    } else {
      console.log(
        `ℹ️  Refresh token: Not available (this is normal for most users)`
      );
    }

    // Step 6: Update .env file
    let envContent = "";
    if (fs.existsSync(".env")) {
      envContent = fs.readFileSync(".env", "utf8");
    }

    // Update access token
    if (envContent.includes("KITE_ACCESS_TOKEN=")) {
      envContent = envContent.replace(
        /KITE_ACCESS_TOKEN=.*/,
        `KITE_ACCESS_TOKEN=${accessToken}`
      );
    } else {
      envContent += `\nKITE_ACCESS_TOKEN=${accessToken}`;
    }

    // Update refresh token (only if it exists)
    if (refreshToken) {
      if (envContent.includes("KITE_REFRESH_TOKEN=")) {
        envContent = envContent.replace(
          /KITE_REFRESH_TOKEN=.*/,
          `KITE_REFRESH_TOKEN=${refreshToken}`
        );
      } else {
        envContent += `\nKITE_REFRESH_TOKEN=${refreshToken}`;
      }
    }

    fs.writeFileSync(".env", envContent);

    if (refreshToken) {
      console.log("✅ .env file updated with access token and refresh token");
      console.log("💡 The app will automatically refresh tokens when needed!");
    } else {
      console.log("✅ .env file updated with access token");
      console.log(
        "ℹ️  No refresh token available - you'll need to re-authenticate daily"
      );
    }

    console.log("\n🎉 Authentication successful!");
    console.log("You can now run: npm run holdings");
  } catch (error) {
    console.error("❌ Authentication failed:", error.message);
  } finally {
    rl.close();
  }
}

authenticate();
