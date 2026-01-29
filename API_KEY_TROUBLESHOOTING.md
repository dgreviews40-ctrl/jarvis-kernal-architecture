# 🔧 API Key Troubleshooting Guide

## Error: "API key not valid"

This means the API key format was accepted, but Google says it's not a real/active key.

---

## ✅ Solution Steps:

### 1️⃣ Get a Valid API Key

**Go to Google AI Studio:**
🔗 https://aistudio.google.com/app/apikey

**Steps:**
- Sign in with your Google account
- Click the blue "Create API Key" button
- Select a project (or create a new one)
- Copy the key (looks like: `AIzaSyD...` - starts with AIza)

⚠️ **Important:** Don't share this key publicly!

---

### 2️⃣ Enter the Key in JARVIS

**Method A: Through the UI** ⭐ Recommended
1. Open JARVIS
2. Click Settings (⚙️ gear icon in top right)
3. Go to "API & SECURITY" tab
4. Paste your API key in the input field
5. Click "SAVE PROTOCOLS"
6. **Refresh the page (F5)** ← Important!

**Method B: Edit .env.local file**
1. Open `.env.local` in your text editor
2. Replace `PLACEHOLDER_API_KEY` with your real key:
   ```
   GEMINI_API_KEY=AIzaSyD_your_actual_key_here
   ```
3. Save the file
4. Restart the dev server:
   - Press `Ctrl+C` in the terminal
   - Run `npm run dev` again

---

### 3️⃣ Verify It's Working

**Check in Browser Console:**
1. Press F12
2. Go to Console tab
3. Type: `localStorage.getItem('GEMINI_API_KEY')`
4. Should show your real key (not null, not PLACEHOLDER)

**Test JARVIS:**
- Ask a question like: "What's 2+2?"
- Should get a real AI response
- Not an error message

---

## 🔄 Alternative: Use Offline Mode

Don't want to use Gemini? Switch to local mode:

1. Click the **CORE ENGINE** button in the header
2. Switch to **SIMULATED (OLLAMA)**
3. Now uses basic rule-based responses
4. No API key needed!

---

## 🐛 Still Not Working?

**Check these common issues:**

❌ Key has extra spaces
   → Make sure no spaces before/after the key

❌ Copied wrong key
   → Key should start with `AIza`

❌ API key was disabled/deleted
   → Create a new one at AI Studio

❌ Page wasn't refreshed
   → Press F5 to reload

❌ Browser cache issue
   → Try opening in Incognito/Private mode

---

## 📝 Quick Reference

**Where keys are stored:**
- UI input → `localStorage` (browser storage)
- `.env.local` file → `process.env` (backup)

**Priority:**
1. localStorage is checked first
2. If empty, falls back to .env.local

**Get Help:**
- Google AI Studio Docs: https://ai.google.dev/docs
- Check browser console (F12) for detailed errors
