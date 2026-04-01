# Financial Structure & Opening Balance Management

## Overview

The pool software now has a complete financial structure that tracks:
- **Opening Balance**: Starting cash for the day (one-time entry)
- **Total Income**: Sum of all revenue streams
- **Total Expense**: Sum of all costs
- **Net Cash**: Daily profit/loss calculation
- **Closing Balance**: Final cash balance

## Financial Formula

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Closing Balance = Opening Balance + Income - Expense      │
│                                                             │
│  Net Cash = Income - Expense (profit/loss for the day)    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Example Calculation

**Given:**
- Opening Balance (Monday): ৳100,000 (cash in hand)
- Total Income (all services): ৳85,320
- Total Expense (all costs): ৳42,150

**Calculation:**
```
Net Cash = 85,320 - 42,150 = 43,170 (profit for the day)
Closing Balance = 100,000 + 43,170 = 143,170 (cash in hand at end of day)
```

---

## Dashboard Components

### 1. Opening Balance Card (🏠)
- **Location**: First card in dashboard stats row
- **What it shows**: Starting cash balance for today
- **How to edit**: 
  - Hover over the card
  - Click the ✏️ Edit button
  - Modal opens to edit/confirm amount

### 2. Total Income Card (💰)
- **Automatically calculated** from:
  - Daily Entry transactions
  - Training sessions
  - Membership payments
  - Beverage sales
- **Updates in real-time** as transactions are added

### 3. Total Expense Card (💸)
- **Automatically calculated** from:
  - Staff Salary
  - Maintenance costs
  - Utility bills
  - Supplies
  - Other expenses
- **Updates in real-time** as expenses are added

### 4. Net Cash Card (🧮)
- **Formula**: Income - Expense
- **Shows**:
  - ✅ Green if positive (profit)
  - ❌ Red if negative (loss/deficit)
- **Not editable** (calculated automatically)

### 5. Closing Balance Card (📤)
- **Formula**: Opening Balance + Net Cash
- **Same as**: Opening Balance + Income - Expense
- **Not editable** (calculated automatically)

---

## How to Use

### Setting Opening Balance

**Every morning (or when starting work):**

1. Go to Dashboard
2. Find the **Opening Balance** card (🏠)
3. Hover to reveal **✏️ Edit** button
4. Click the button - modal opens
5. Enter the opening balance amount
   - This is the **cash in hand** at the start of the day
   - Example: If you collected yesterday's closing balance in cash, enter that amount
6. Optionally add notes (e.g., "Carried from yesterday", "Bank deposit of ৳50,000")
7. Click **💾 Save**
8. Dashboard refreshes automatically

### Optional Notes

Use the notes field to track:
- ✅ "Carried over from yesterday - closing was ৳xx,xxx"
- ✅ "Bank deposit: ৳50,000"
- ✅ "Petty cash addition"
- ✅ "Previous day settlement"

### Tracking Daily Cash Flow

The dashboard shows everything simultaneously:
- How much cash you started with (Opening Balance)
- How much came in today (Income)
- How much you spent (Expense)
- Net profit/loss (Net Cash)
- Final cash balance (Closing Balance)

**This gives you a complete picture of daily finances in one view.**

---

## Important Notes

### One-Time Entry Per Day
- Opening Balance is set **once per day**
- When you change the date range (Yesterday, Last 7 Days, etc.), it shows the opening balance for that date range's start date
- This allows tracking historical opening balances

### Opening Balance is NOT Cumulative
- Opening Balance = Cash on hand at start
- It does NOT auto-carry to the next day
- You must manually set it each day
- This gives you control and flexibility

### Negative Balances
- If Closing Balance is negative, you're in deficit
- Example: Opening 0 + Income 33,740 - Expense 210,001 = **-176,261**
- This means expenses exceeded income and available cash

### Date Range Changes
When you switch date ranges:
- **Today**: Shows opening balance for today
- **Yesterday**: Shows opening balance for yesterday
- **Last 7 Days**: Shows opening balance for 7 days ago
- **This Month**: Shows opening balance for the 1st of the month
- **Custom**: Shows opening balance for your start date

---

## Common Scenarios

### Scenario 1: Starting a New Day

**9:00 AM Monday:**
1. Check your cash box - you have ৳100,000
2. Go to dashboard, edit Opening Balance
3. Enter: 100,000
4. Throughout the day:
   - Members pay: +৳25,000 (Income)
   - Staff salary: -৳10,000 (Expense)
   - Supplies purchased: -৳5,000 (Expense)
5. Dashboard shows:
   - Opening: 100,000
   - Income: 25,000
   - Expense: 15,000
   - **Closing: 110,000** ✓

### Scenario 2: Deficit Recovery

**Today's Status:**
- Opening: 50,000
- Income: 30,000
- Expense: 20,000
- **Closing: 60,000** (profit of 10,000)

### Scenario 3: Bank Deposit

**After depositing yesterday's cash:**
- Yesterday Closing: 143,170
- Today Opening: 0 (cash box empty)
- Bank Deposit today: 143,170 (note this in Opening Balance notes)
- Today Income/Expense tracked separately
- **This keeps yesterday's cash separate from today's operations**

---

## Financial Reports

The system generates these reports automatically:

### Income Report (`/income`)
- Shows income by service type
- Includes opening balance
- Timeline of income over time
- Service distribution breakdown

### Expense Report (`/expenses`)
- Shows expenses by category
- Breakdown by payment method
- Category-wise analysis

### Financial Summary (`/financial-summary`)
- Opening Balance + Total Income - Total Expense
- Complete financial overview
- Available for custom date ranges

---

## API Endpoints

### Set/Update Opening Balance
```
POST /opening-balance
Body: {
  "date": "2026-03-31",
  "amount": 100000,
  "notes": "Carried from yesterday"
}
```

### Get Opening Balance for a Date
```
GET /opening-balance?date=2026-03-31
```

### Get Income Report with Opening Balance
```
GET /reports/income?range=today
Returns: openingBalance, totalIncome, totalExpense, netCash, closingBalance, etc.
```

---

## Tips for Accurate Tracking

1. **Set Opening Balance Every Day**
   - Do this at the start of your workday
   - Count your physical cash in hand

2. **Record All Transactions**
   - Every sale/membership/training
   - Every expense (salary, supplies, etc.)

3. **Review Before Closing**
   - Check the Closing Balance at day end
   - Count your physical cash
   - They should match (approximately)
   - Difference = possible errors/theft/loss

4. **Use Notes Field**
   - Track major deposits/withdrawals
   - Helps audit trail
   - Useful for reconciliation

5. **Check Weekly Trends**
   - Use "Last 7 Days" view
   - Identify profitable days
   - Spot expense patterns

---

## Troubleshooting

### Q: Why is Closing Balance negative?
**A:** If expenses exceed open balance + income, it will be negative. This means the business is operating at a loss for the day or doesn't have enough cash.

### Q: Opening Balance doesn't appear on dashboard?
**A:** 
- Make sure it's set for today's date
- The system looks for opening balance matching the date range start date
- Use the edit button to confirm it's saved

### Q: Why did Opening Balance change?
**A:**
- Someone edited it (only admins can do this)
- You switched to a different date range (showing that date's opening balance)
- Check the date in the modal

### Q: Can I set Opening Balance for past dates?
**A:**
- Yes, the modal allows selecting any date
- You can correct historical data
- Only admin users can do this

### Q: Should I set Opening Balance to 0?
**A:**
- No, if you have cash in the cash box
- Only set to 0 if genuinely starting fresh with no cash
- This helps track actual cash on hand

---

## Best Practices

✅ **DO:**
- Set opening balance every morning
- Keep notes for major transactions
- Review closing balance daily
- Reconcile with physical cash weekly
- Archive opening balances monthly

❌ **DON'T:**
- Leave opening balance as 0 if you have cash
- Skip setting daily opening balance
- Ignore negative closing balances (investigate cause)
- Use for multiple days (set fresh each day)
- Forget to verify physical cash matches digital balance

---

## Integration with Other Modules

### Membership Module
- Payments recorded as "Membership" income
- Automatically added to Total Income
- Counted in Closing Balance formula

### Training Module
- Class payments recorded as "Training" income
- Automatically added to Total Income
- Counted in Closing Balance formula

### Beverage Sales Module
- Beverage sales recorded separately
- Automatically added to Total Income
- Counted in Closing Balance formula

### Expense Module
- All expenses tracked here
- Subtracted from Total Income
- Included in Net Cash and Closing Balance

---

## Summary

**The Financial Flow:**
```
┌──────────────────────────────────────────────────────────┐
│                 OPENING BALANCE                          │
│            (Cash you start with today)                   │
└──────────────────────────────────────────────────────────┘
                           ↓
              ┌────────────┴────────────┐
              ↓                         ↓
        ADD INCOME                SUBTRACT EXPENSE
    (Sales, training,         (Staff, supplies,
     membership, beverages)     maintenance, utility)
              ↓                         ↓
              └────────────┬────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  NET CASH = Income - Expense         │
        │  (Profit or Loss for the day)        │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │ CLOSING BALANCE = Opening +          │
        │ Total Income - Total Expense         │
        │ (Cash you end with today)            │
        └──────────────────────────────────────┘
```

This structure ensures complete financial transparency and daily cash tracking.
