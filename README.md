# St. Clare's Endo Schedule

A simple shift rotation scheduler for St. Clare's Endoscopy team. Employees automatically rotate through different time slots each week.

## Features

- 📅 **Weekly Rotation**: Employees cycle through time slots each week
- ⚙️ **Configurable**: Add/remove employees and time slots
- 📱 **Responsive**: Works on desktop and mobile
- 💾 **Saves Settings**: Configuration is saved in your browser
- 🖨️ **Print Friendly**: Clean printable schedule
- 📍 **Current Week Highlight**: Automatically shows and highlights the current week

## How It Works

Each employee rotates through the available time slots on a weekly basis. For example, with 3 employees and 3 time slots:

| Week | Employee 1 | Employee 2 | Employee 3 |
|------|------------|------------|------------|
| 1    | 9-5        | 9:30-5:30  | 7:30-3:30  |
| 2    | 9:30-5:30  | 7:30-3:30  | 9-5        |
| 3    | 7:30-3:30  | 9-5        | 9:30-5:30  |
| 4    | 9-5        | 9:30-5:30  | 7:30-3:30  |

## Usage

1. Open the page in a web browser
2. Click **⚙️ Configure** to set up:
   - Employee names
   - Time slots (e.g., "9:00 AM - 5:00 PM")
   - Rotation start week
3. Click **Save & Generate Schedule**
4. Use the dropdowns to:
   - Select a different year
   - Jump to a specific week

## Hosting on GitHub Pages

1. Create a new repository on GitHub (e.g., `endo-schedule`)
2. Upload these files to the repository:
   - `index.html`
   - `styles.css`
   - `app.js`
3. Go to **Settings** → **Pages**
4. Under "Source", select **Deploy from a branch**
5. Select **main** branch and **/ (root)** folder
6. Click **Save**
7. Your site will be live at: `https://yourusername.github.io/endo-schedule/`

## Quick Deploy Commands

```bash
# Navigate to this folder
cd endoschedule

# Initialize git repository
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - St. Clare's Endo Schedule"

# Add your GitHub repository as remote (replace with your repo URL)
git remote add origin https://github.com/yourusername/endo-schedule.git

# Push to GitHub
git push -u origin main
```

## Customization

The default configuration includes:
- 3 employees (Employee 1, 2, 3)
- 3 time slots (9-5, 9:30-5:30, 7:30-3:30)

Use the Configure button to customize these for your team!

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge).
