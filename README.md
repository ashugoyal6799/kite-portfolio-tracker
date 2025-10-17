# 📊 Daily Portfolio Updates - Kite Connect

A Node.js application that fetches your stock portfolio holdings from Zerodha Kite Connect and sends detailed reports via email.

## 🚀 What It Does

- **Fetches Portfolio Data**: Retrieves your current stock holdings from Zerodha Kite Connect API
- **Generates Excel Reports**: Creates detailed Excel files with holdings, P&L, and performance metrics
- **Sends Email Reports**: Automatically emails the reports to specified recipients
- **Auto Token Refresh**: Handles Kite Connect token expiration and refresh automatically

## 🏗️ How It Works

1. **Authentication**: Uses Kite Connect API with OAuth flow for secure access
2. **Data Fetching**: Retrieves real-time portfolio data including:
   - Stock symbols and quantities
   - Average prices and current prices
   - Invested value and current value
   - P&L (absolute and percentage)
3. **Report Generation**: Creates formatted Excel files with comprehensive portfolio analysis
4. **Email Delivery**: Sends HTML-formatted emails with portfolio summary and Excel attachments

## 📋 Prerequisites

- Node.js (v14 or higher)
- Zerodha Kite Connect API credentials
- Gmail account for sending emails
- Active Zerodha trading account

## 🛠️ Installation

1. **Clone the repository**:

   ```bash
   git clone <your-repo-url>
   cd daily-updates-kite
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment variables**:

   ```bash
   cp .env.example .env
   ```

4. **Configure your `.env` file** with your credentials:

   ```env
   # Email Configuration
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   EMAIL_TO=recipient1@gmail.com,recipient2@gmail.com

   # Kite API Configuration
   KITE_API_KEY=your_api_key
   KITE_API_SECRET=your_api_secret
   ```

## 🔐 Authentication Setup

1. **Get Kite Connect credentials** from [Zerodha Developer Console](https://developers.kite.trade/)

2. **Run authentication**:

   ```bash
   npm run auth
   ```

3. **Follow the prompts**:
   - Browser will open Zerodha login page
   - Login with your Zerodha credentials
   - Complete 2FA if prompted
   - Copy the callback URL and paste it in terminal
   - Access token will be automatically saved to `.env`

## 📖 Usage

### Generate Holdings Report

```bash
npm run holdings
```

## 📧 Email Reports

Each email includes:

- **Portfolio Summary**: Total holdings, invested value, current value, P&L
- **Detailed Holdings Table**: Individual stock performance
- **Excel Attachment**: Complete data for further analysis

## 🔄 Token Management

- **Auto-refresh**: App automatically refreshes expired tokens when possible
- **Manual refresh**: If auto-refresh fails, run `npm run auth` to re-authenticate
- **Token validation**: Validates tokens before each API call

## 📁 Output Files

Generated Excel files are saved in the `output/` directory:

- Format: `holdings_YYYY-MM-DD.xlsx`
- Contains: Symbol, Quantity, Avg Price, Current Price, Invested Value, Current Value, P&L, P&L%

## 🛡️ Security

- All credentials stored in environment variables
- `.env` file is gitignored and never committed
- Uses secure OAuth flow for Kite Connect authentication
- No hardcoded sensitive information

## 🚨 Troubleshooting

### Common Issues

1. **"Email credentials not configured"**

   - Check your `.env` file has correct email settings
   - Use Gmail App Password instead of regular password

2. **"Access token expired"**

   - Run `npm run auth` to re-authenticate
   - Check if your Kite Connect session is still active

3. **"No email recipients configured"**
   - Add email addresses to `EMAIL_TO` in `.env` file
   - Separate multiple emails with commas

### Gmail Setup

1. Enable 2-factor authentication
2. Generate an App Password
3. Use the App Password in `EMAIL_PASS`

## 📦 Dependencies

- `axios`: HTTP client for API calls
- `nodemailer`: Email sending functionality
- `xlsx`: Excel file generation
- `dotenv`: Environment variable management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

ISC License - see package.json for details

## ⚠️ Disclaimer

This tool is for personal use only. Always ensure compliance with Zerodha's terms of service and API usage policies. The authors are not responsible for any financial decisions made based on this tool's output.
