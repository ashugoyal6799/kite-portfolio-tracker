#!/usr/bin/env node

const axios = require("axios");
const nodemailer = require("nodemailer");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

class StockApp {
  constructor() {
    this.emailConfig = {
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT) || 587,
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
      to: this.parseEmailRecipients(process.env.EMAIL_TO),
    };

    this.kiteConfig = {
      apiKey: process.env.KITE_API_KEY,
      accessToken: process.env.KITE_ACCESS_TOKEN,
    };

    this.transporter = null;
  }

  // Parse email recipients (support multiple emails)
  parseEmailRecipients(emailString) {
    if (!emailString) return [];

    // Split by comma and clean up whitespace
    return emailString
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email && email.includes("@"));
  }

  // Initialize email transporter
  initEmail() {
    // Validate email configuration
    if (!this.emailConfig.user || !this.emailConfig.pass) {
      throw new Error("Email credentials not configured");
    }

    if (!this.emailConfig.to || this.emailConfig.to.length === 0) {
      throw new Error("No email recipients configured");
    }

    this.transporter = nodemailer.createTransport({
      host: this.emailConfig.host,
      port: this.emailConfig.port,
      secure: false,
      auth: {
        user: this.emailConfig.user,
        pass: this.emailConfig.pass,
      },
    });
  }

  // Check if access token is valid
  async validateAccessToken() {
    try {
      const response = await axios.get("https://api.kite.trade/user/profile", {
        headers: {
          "X-Kite-Version": "3",
          Authorization: `token ${this.kiteConfig.apiKey}:${this.kiteConfig.accessToken}`,
        },
      });

      // Check if response is successful and contains user data
      return response.status === 200 && response.data.status === "success";
    } catch (error) {
      console.log(
        `🔍 Token validation failed: ${error.response?.status || error.message}`
      );
      return false;
    }
  }

  // Auto-refresh access token if needed
  async ensureValidToken() {
    const isValid = await this.validateAccessToken();
    if (!isValid) {
      console.log("🔄 Access token expired or invalid");

      // Try auto-refresh first (if refresh token is available)
      const refreshToken = process.env.KITE_REFRESH_TOKEN;
      if (refreshToken && refreshToken.trim() !== "") {
        console.log("🔄 Attempting auto-refresh...");
        try {
          await this.autoRefreshToken();
          return; // Success, exit early
        } catch (error) {
          console.log("❌ Auto-refresh failed, manual authentication required");
        }
      } else {
        console.log("ℹ️  No refresh token available for auto-refresh");
      }

      // If we reach here, manual authentication is required
      throw new Error(
        "Access token expired. Please run 'npm run auth' to re-authenticate."
      );
    }
  }

  // Auto-refresh token using stored refresh token
  async autoRefreshToken() {
    try {
      const refreshToken = process.env.KITE_REFRESH_TOKEN;

      // Check if refresh token exists and is not empty
      if (!refreshToken || refreshToken.trim() === "") {
        throw new Error(
          "No refresh token available. Please run 'npm run auth' manually."
        );
      }

      console.log("🔄 Attempting token refresh...");

      const response = await axios.post(
        "https://api.kite.trade/session/refresh_token",
        {
          refresh_token: refreshToken,
          api_key: this.kiteConfig.apiKey,
          api_secret: process.env.KITE_API_SECRET,
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Kite-Version": "3",
          },
        }
      );

      const newAccessToken = response.data.data.access_token;
      const newRefreshToken = response.data.data.refresh_token || refreshToken; // Fallback to old token if new one is empty

      // Update .env file
      await this.updateEnvTokens(newAccessToken, newRefreshToken);

      // Update in-memory config
      this.kiteConfig.accessToken = newAccessToken;

      console.log("✅ Token refreshed successfully");
    } catch (error) {
      console.log("❌ Auto-refresh failed:", error.message);
      console.log(
        "💡 This is normal - most users don't have refresh tokens enabled"
      );
      throw new Error("Please run 'npm run auth' to re-authenticate manually.");
    }
  }

  // Update tokens in .env file
  async updateEnvTokens(accessToken, refreshToken) {
    const fs = require("fs");
    const path = require("path");

    const envPath = path.join(process.cwd(), ".env");
    let envContent = fs.readFileSync(envPath, "utf8");

    // Update access token
    envContent = envContent.replace(
      /KITE_ACCESS_TOKEN=.*/,
      `KITE_ACCESS_TOKEN=${accessToken}`
    );

    // Update refresh token
    if (envContent.includes("KITE_REFRESH_TOKEN=")) {
      envContent = envContent.replace(
        /KITE_REFRESH_TOKEN=.*/,
        `KITE_REFRESH_TOKEN=${refreshToken}`
      );
    } else {
      envContent += `\nKITE_REFRESH_TOKEN=${refreshToken}`;
    }

    fs.writeFileSync(envPath, envContent);
  }

  // Fetch holdings from Kite Connect
  async fetchHoldings() {
    if (!this.kiteConfig.apiKey || !this.kiteConfig.accessToken) {
      throw new Error("Kite credentials not configured");
    }

    console.log("📊 Fetching holdings from Kite Connect...");

    // Ensure we have a valid token
    await this.ensureValidToken();

    const response = await axios.get(
      "https://api.kite.trade/portfolio/holdings",
      {
        headers: {
          "X-Kite-Version": "3",
          Authorization: `token ${this.kiteConfig.apiKey}:${this.kiteConfig.accessToken}`,
        },
      }
    );

    const holdings = response.data.data || [];
    console.log(`✓ Fetched ${holdings.length} holdings`);

    return holdings.map((holding) => ({
      symbol: holding.tradingsymbol,
      quantity: holding.quantity,
      avgPrice: holding.average_price,
      currentPrice: holding.last_price,
      investedValue: holding.quantity * holding.average_price,
      currentValue: holding.quantity * holding.last_price,
      pnl:
        holding.quantity * holding.last_price -
        holding.quantity * holding.average_price,
      pnlPercent:
        ((holding.quantity * holding.last_price -
          holding.quantity * holding.average_price) /
          (holding.quantity * holding.average_price)) *
        100,
    }));
  }

  // Generate Excel file
  generateExcel(data) {
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `holdings_${timestamp}.xlsx`;
    const filepath = path.join(__dirname, "output", filename);

    // Ensure output directory exists
    if (!fs.existsSync(path.join(__dirname, "output"))) {
      fs.mkdirSync(path.join(__dirname, "output"), { recursive: true });
    }

    const workbook = XLSX.utils.book_new();

    const worksheet = XLSX.utils.json_to_sheet(
      data.map((holding) => ({
        Symbol: holding.symbol,
        Quantity: holding.quantity,
        "Avg Price": holding.avgPrice,
        "Current Price": holding.currentPrice,
        "Invested Value": holding.investedValue,
        "Current Value": holding.currentValue,
        PnL: holding.pnl,
        "PnL %": holding.pnlPercent.toFixed(2),
      }))
    );
    XLSX.utils.book_append_sheet(workbook, worksheet, "Holdings");

    XLSX.writeFile(workbook, filepath);
    console.log(`📁 Excel generated: ${filename}`);
    return { filename, filepath };
  }

  // Send email with attachment
  async sendEmail(filepath, data) {
    const timestamp = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const totalInvested = data.reduce((sum, h) => sum + h.investedValue, 0);
    const totalCurrent = data.reduce((sum, h) => sum + h.currentValue, 0);
    const totalPnL = totalCurrent - totalInvested;
    const totalPnLPercent = (totalPnL / totalInvested) * 100;

    const subject = `💼 Portfolio Holdings Report - ${new Date().toLocaleDateString(
      "en-IN"
    )}`;

    // Create detailed holdings table
    const holdingsTable = data
      .map(
        (holding) => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px; font-weight: bold;">${holding.symbol}</td>
          <td style="padding: 8px;">${holding.quantity}</td>
          <td style="padding: 8px;">₹${holding.avgPrice.toFixed(2)}</td>
          <td style="padding: 8px;">₹${holding.currentPrice.toFixed(2)}</td>
          <td style="padding: 8px;">₹${holding.investedValue.toLocaleString()}</td>
          <td style="padding: 8px;">₹${holding.currentValue.toLocaleString()}</td>
          <td style="padding: 8px; color: ${
            holding.pnl >= 0 ? "green" : "red"
          };">
            ₹${holding.pnl.toLocaleString()}
          </td>
          <td style="padding: 8px; color: ${
            holding.pnlPercent >= 0 ? "green" : "red"
          };">
            ${holding.pnlPercent.toFixed(2)}%
          </td>
        </tr>
      `
      )
      .join("");

    const htmlContent = `
      <h2>💼 Portfolio Holdings Report</h2>
      <p>Generated on: ${timestamp}</p>
      
      <h3>📊 Portfolio Summary</h3>
      <ul>
        <li><strong>Total Holdings:</strong> ${data.length} stocks</li>
        <li><strong>Total Invested:</strong> ₹${totalInvested.toLocaleString()}</li>
        <li><strong>Current Value:</strong> ₹${totalCurrent.toLocaleString()}</li>
        <li><strong>Total P&L:</strong> ₹${totalPnL.toLocaleString()} 
            <span style="color: ${totalPnL >= 0 ? "green" : "red"};">
              (${totalPnLPercent.toFixed(2)}%)
            </span>
        </li>
      </ul>

      <h3>📋 Detailed Holdings</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Symbol</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Qty</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Avg Price</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Current Price</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Invested</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Current Value</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">P&L</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">P&L %</th>
          </tr>
        </thead>
        <tbody>
          ${holdingsTable}
        </tbody>
      </table>

      <p><strong>📎 Detailed Excel report attached for further analysis.</strong></p>
    `;

    const mailOptions = {
      from: `"Stock Updates" <${this.emailConfig.user}>`,
      to: this.emailConfig.to,
      subject: subject,
      html: htmlContent,
      attachments: [
        {
          filename: path.basename(filepath),
          path: filepath,
        },
      ],
    };

    await this.transporter.sendMail(mailOptions);

    // Display recipients nicely
    const recipients = Array.isArray(this.emailConfig.to)
      ? this.emailConfig.to.join(", ")
      : this.emailConfig.to;
    console.log(`📧 Email sent to: ${recipients}`);
  }

  // Run holdings report
  async runHoldingsReport() {
    try {
      console.log("🚀 Starting holdings report...");

      this.initEmail();
      const holdings = await this.fetchHoldings();
      const excel = this.generateExcel(holdings);
      await this.sendEmail(excel.filepath, holdings);

      console.log("✅ Holdings report completed!");
    } catch (error) {
      console.error("❌ Holdings report failed:", error.message);
    }
  }
}

// CLI Interface
async function main() {
  const app = new StockApp();
  const command = process.argv[2];

  switch (command) {
    case "holdings":
      await app.runHoldingsReport();
      break;

    default:
      console.log(`
💼 Portfolio Holdings App

Usage:
  node app.js holdings - Send holdings report

Examples:
  npm run holdings     - Send holdings report
      `);
      break;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ App error:", error.message);
    process.exit(1);
  });
}

module.exports = StockApp;
