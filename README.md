# 📱 BillMaker - Plumbing & Civil Works Mobile Billing App

A lightweight, mobile-first billing application built with **React Native (Expo SDK 57)** and **TypeScript**, specifically designed for contractors and family members working on active construction and plumbing sites.

---

## 🏗️ Designed for Non-Tech-Savvy Site Work

- **Big, High-Contrast Touch Targets**: Easy to read under sunlight with dusty hands.
- **Pre-loaded Catalog (No Typing Needed)**:
  - **Plumbing**: CPVC Pipes (3/4", 1"), Elbows, Tees, Diverters, Taps, Stop Cocks, PVC Drain Pipes, Solvents, Tank fittings.
  - **Civil & Materials**: Cement bags, Sand/Reti, Aggregate/Gitti, Bricks, AAC blocks, Steel/Sariya, Dr. Fixit chemical, Tiles.
  - **Labor**: Daily Plumber / Mason (Mistri) labor, Helper (Koolie) charges, Plumbing Point charges, Wall plaster, Core cutting, Chasing/Jhirri.
  - Standard Units: `pcs`, `bags`, `ft`, `days`, `pts`, `sq.ft`, `brass`, `kg`, `lump-sum`.
- **Automatic Arithmetic**: Subtotal, discounts, advance received (जमा), and balance due (बाकी) are calculated instantly.
- **1-Tap WhatsApp PDF Sharing**: Generates a professional invoice with your business letterhead, client details, item table, and UPI payment details, then immediately opens WhatsApp to send to the client.
- **100% Offline**: Works anywhere without needing an active internet connection.

---

## 🚀 How to Run the App (Zero Setup)

Since this project uses Expo, you do not need Android Studio or Xcode installed on your machine to test it.

### Step 1: Install Dependencies (Already installed)
If setting up on a new machine:
```bash
npm install
```

### Step 2: Start the Expo Development Server
```bash
npx expo start
```
This will start Metro bundler and display a large QR code in your terminal.

### Step 3: Run on Your Family's Phone via Expo Go
1. **On Android**: Install the **Expo Go** app from Google Play Store. Open Expo Go and tap **"Scan QR code"**, then scan the QR code from your computer terminal.
2. **On iPhone**: Install the **Expo Go** app from the App Store. Open the default **Camera app**, point it at the QR code, and tap the Expo banner that pops up.
*(Ensure your phone and computer are connected to the same Wi-Fi network).*

---

## 📁 Project Structure

```
BillMaker/
├── assets/                  # App icons, splash screens
├── src/
│   ├── components/          # Reusable, accessible UI components
│   │   ├── BigButton.tsx            # High-contrast large touch button
│   │   ├── CustomInput.tsx          # Clean input with clear labels
│   │   └── ItemQuickPickerModal.tsx # Quick-pick catalog modal
│   ├── constants/
│   │   └── theme.ts         # Construction site color palette & sizing
│   ├── data/
│   │   └── presets.ts       # Predefined plumbing, civil, and labor items
│   ├── screens/
│   │   ├── HomeScreen.tsx           # Dashboard: Total billed, pending dues, recent bills
│   │   ├── CreateBillScreen.tsx     # Step-by-step quick bill creator
│   │   ├── BillDetailScreen.tsx     # Bill breakdown & 1-tap WhatsApp PDF share
│   │   └── SettingsScreen.tsx       # Business profile (Name, Phone, UPI ID, Bank)
│   ├── services/
│   │   ├── pdfService.ts            # expo-print HTML-to-PDF & expo-sharing
│   │   └── storageService.ts        # Offline AsyncStorage persistence
│   ├── types/
│   │   └── bill.ts          # TypeScript models
│   └── utils/
│       └── formatters.ts    # Indian Rupee (₹), dates, and bill numbers
├── App.tsx                  # Root navigation stack configuration
├── app.json                 # Expo project metadata
├── package.json             # Dependencies
└── tsconfig.json            # TypeScript configuration
```

---

## 📄 Generating Invoices & Sharing to WhatsApp

1. In the app, tap **"+ नया बिल बनाएँ (New Bill)"**.
2. Enter the customer name (e.g. *Mr. Sharma*) and optional phone or site address.
3. Tap **"+ सामान या लेबर जोड़ें (Add Item)"** and select any plumbing or civil item from the catalog. Enter the quantity.
4. (Optional) Enter Advance Paid (जमा राशि) if the client gave cash.
5. Tap **"Save & Create Bill"**.
6. On the preview screen, tap **"WhatsApp पर PDF भेजें (Share via WhatsApp)"** to send the invoice directly to the client or customer!
