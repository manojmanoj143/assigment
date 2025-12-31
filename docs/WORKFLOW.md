# Military Asset Management System - Workflow Guide

This document outlines the step-by-step workflow for using the Military Asset Management System.

## 1. Starting the Application
1.  Navigate to the project folder.
2.  Double-click the **`start_app.bat`** file.
3.  Two command windows will open (Backend and Frontend).
4.  The application will automatically open in your default browser at `http://localhost:5173`.

---

## 2. Login & Roles
The system supports Role-Based Access Control (RBAC). Use the buttons on the Login page to simulate different users:

*   **Admin (`admin`)**: Full access to all features and all bases.
*   **Logistics Officer (`logistics`)**: Can Purchase and Transfer assets. View-only access to Assignments.
*   **Base Commander (`commander`)**: Can Assign and Expend assets. View-only access to Logistics.

---

## 3. Workflow Scenarios

### A. Purchasing Assets (In-Flow)
*Target User: Logistics Officer / Admin*

1.  Go to the **Purchases** page.
2.  **Target Base**: Select which base receives the new assets.
3.  **Asset Class**: Choose the item (e.g., M4 Carbine).
4.  **Quantity**: Enter the amount (e.g., 100).
5.  Click **"Record Purchase"**.
6.  *Result*: Inventory is added to the selected base.

### B. Transferring Assets (Move)
*Target User: Logistics Officer / Admin*

1.  Go to the **Transfers** page.
2.  **Origin Point**: Select the source base (if Admin) or verify your current base.
3.  **Destination Point**: Select where the assets are going.
4.  **Asset Manifest**: Choose the asset.
5.  **Volume**: Enter quantity.
6.  Click **"Execute Transfer"**.
7.  *Result*: Assets move from Source to Destination.
    *   **Note**: If the Source has 0 items, the transfer will still succeed, resulting in a negative balance (e.g., -10) to prevent operational blockers.

### C. Field Operations (Assign/Expend)
*Target User: Commander / Admin*
*Feature: Zero-Blocking / Negative Inventory Support*

1.  Go to the **Assignments** page.
2.  Select Mode: **"Assign to Personnel"** (Blue) or **"Record Expenditure"** (Red).
    *   **Assign**: Checking items out to soldiers (e.g., Weapons, Vehicles).
    *   **Expend**: Consumable usage (e.g., Ammunition, Fuel).
3.  **Operation Base**: Your assigned base.
4.  **Select Asset**: Choose the item.
5.  **Deployment Count**: Enter quantity (e.g., 5).
6.  Click **"Confirm Assignment"**.
7.  *Result*: The transaction is recorded immediately.
    *   **Success**: You will see a green banner: *"Assignment recorded successfully"*.
    *   **No Errors**: Even if your base has 0 or negative inventory, the system **will NOT block** you. It will simply decrease the balance further (e.g., 0 -> -5).

---

## 4. Monitoring
### Dashboard
*   View **Current Inventory** across all bases.
*   View **Net Movements** (Purchases vs. Expended).
*   Use filters to drill down by specific Base or Asset Type.

### History
*   All transactions (Purchases, Transfers, Assignments) are logged in the database and affect the calculated "Closing Balance".
