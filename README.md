# FutureCrop AI  <img src="https://github.com/CosmicCoderX/FutureCrop/blob/main/images/AgriSenseLogo.png" alt="FutureCrop Logo" width="40" height="40" align="right">
An AI-powered agriculture assistant offering **Crop Recommendation**, **Price Prediction**, and **Role‑based Access** with a modern dark‑theme UI.

---
## 🚀 Features
- 🌱 **Crop Recommendation** using ML
- 💰 **Price Prediction** with time‑series forecasting
- 🔐 **Firebase Authentication** (Farmer / Customer / Dealer)
- 📊 **Interactive Dashboards**
- 🎨 Modern dark UI

---
## 🧰 Tech Stack
**Frontend:** HTML, CSS, JS  
**Backend:** Python, FastAPI / Flask  
**Auth:** Firebase  
**ML:** sklearn, pandas, numpy

---
## 🔧 Backend Setup
### **Crop Recommendation API**
```
cd backendCrop
pip install -r requirements.txt
python app.py
```
Default endpoint:
```
http://127.0.0.1:8000/predict
```

### **Price Prediction API**
```
cd backendPrice
pip install -r requirements.txt
python -m uvicorn backendPrice.app:app --reload --port 8010
```
Default endpoint:
```
http://127.0.0.1:8010/forecast
```

### **Weather Prediction API**
```
cd backendWeather
pip install -r requirements.txt
python -m uvicorn backendWeather.main:app --reload --port 8020
```
Default endpoint:
```
http://127.0.0.1:8020/predict
```

---
## 🔐 Firebase Setup
1. Create Firebase project
2. Enable **Email/Password** login
3. Copy Web App config → paste in `auth/firebase.js`

---
## ▶️ Run the Project
1. Start both backend servers
2. Open `index.html` in browser
3. Login → Access dashboard

---
## 🌐 Live Demo
**Demo:** https://your-demo-link-here

---
## 🤝 Contributing
Pull requests are welcome.

