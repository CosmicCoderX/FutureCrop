# Future Crop AI 🌱 <img src="https://github.com/CosmicCoderX/FutureCrop/blob/main/images/AgriSenseLogo.png" alt="FutureCrop Logo" width="40" height="40" align="right">

**An AI-Powered Smart Agriculture Platform** offering **Crop Recommendation**, **Price Prediction**, and **Weather Forecasting** with a modern dark-theme UI and **Role-Based Access**.

Empowering farmers with data-driven decisions to analyze soil health, discover perfect crops, predict market prices, and monitor weather patterns to maximize yield and profitability.

---

## 🚀 Features
- 🌱 **Crop Recommendation:** AI-driven suggestions based on soil and climate data.
- 💰 **Price Prediction:** Time-series forecasting for agricultural market prices.
- 🌤️ **Weather Forecast:** Real-time weather monitoring and predictions for better crop management.
- 🔐 **Firebase Authentication:** Secure role-based login (Farmer / Customer / Dealer).
- 📊 **Interactive Dashboards:** Clear and responsive data visualization.
- 🎨 **Modern UI/UX:** Sleek dark-mode aesthetic with animations and responsive design.

---

## 🧰 Tech Stack
- **Frontend:** HTML5, CSS3, Vanilla JavaScript, AOS Animations
- **Backend:** Python, FastAPI, Flask
- **Auth & Database:** Firebase
- **Machine Learning:** scikit-learn, pandas, numpy

---

## 🔧 Backend Setup

The platform uses three separate microservices for its AI features. Open three separate terminal windows to run them simultaneously.

### 1. **Crop Recommendation API**
```bash
cd backendCrop
pip install -r requirements.txt
python app.py
```
*Default endpoint: `http://127.0.0.1:8000/predict`*

### 2. **Price Prediction API**
```bash
cd backendPrice
pip install -r requirements.txt
uvicorn app:app --reload --port 8010
```
*Default endpoint: `http://127.0.0.1:8010/forecast`*

### 3. **Weather Prediction API**
```bash
cd backendWeather
pip install -r requirements.txt
uvicorn main:app --reload --port 5000
```
*Default endpoint: `http://127.0.0.1:5000/predict`*

---

## 🔐 Firebase Setup
1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Email/Password** Authentication.
3. Copy your Web App configuration and paste it into the `auth/firebase.js` (or respective config) file.

---

## ▶️ Run the Project
1. Start all three backend servers as described in the Backend Setup section.
2. Open `index.html` in your web browser (or use an extension like Live Server).
3. Log in to access the platform's features and dashboards.

---

## 🤝 Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.
