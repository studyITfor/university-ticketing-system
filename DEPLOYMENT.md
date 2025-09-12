# 🚀 Railway Deployment Guide

## University Ticketing System - Railway Deployment

This guide will help you deploy the University Ticketing System to Railway, a platform that supports WebSocket connections and real-time functionality.

## 📋 Prerequisites

- GitHub account
- Railway account (sign up at [railway.app](https://railway.app))
- Git installed locally
- Node.js 18+ installed locally

## 🔧 Step 1: Prepare the Repository

### 1.1 Initialize Git Repository

```bash
# Initialize git repository
git init

# Add all files
git add .

# Make initial commit
git commit -m "Initial commit: University Ticketing System with Railway deployment"

# Set main branch
git branch -M main
```

### 1.2 Push to GitHub

```bash
# Add GitHub remote (replace with your username)
git remote add origin https://github.com/yourusername/university-ticketing-system.git

# Push to GitHub
git push -u origin main
```

## 🌐 Step 2: Deploy on Railway

### 2.1 Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click "Sign Up" or "Login"
3. Sign up with your GitHub account

<<<<<<< HEAD
### 2.2 Set Up Database (PostgreSQL)

1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Wait for the database to be created
4. Note the `DATABASE_URL` from the database service
5. Copy the `DATABASE_URL` for later use

### 2.3 Create New Project
=======
### 2.2 Create New Project
>>>>>>> 74c9fcf316183f5cb92f50ddf6239ab0a7130e6a

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your `university-ticketing-system` repository
4. Click "Deploy"

### 2.3 Configure Environment Variables

1. Go to your project dashboard
2. Click on your service
3. Go to "Variables" tab
4. Add the following environment variables:

```
NODE_ENV=production
PORT=3000
```

### 2.4 Generate Domain

1. Go to "Settings" → "Networking"
2. Click "Generate Domain"
3. Copy the generated URL (e.g., `https://your-app-name.railway.app`)

## ✅ Step 3: Verify Deployment

### 3.1 Check Application Status

1. Go to your Railway project dashboard
2. Check the "Deployments" tab
3. Ensure the deployment is successful (green status)

### 3.2 Test Application URLs

- **Main Application:** `https://your-app-name.railway.app`
- **Admin Panel:** `https://your-app-name.railway.app/admin.html`
- **Student Interface:** `https://your-app-name.railway.app/index.html`
- **API Base:** `https://your-app-name.railway.app/api/`

### 3.3 Test API Endpoints

Use the provided Postman collection (`postman/collection.json`) to test:

1. **System Health:** `/api/test/socket-info`
2. **Seat Status:** `/api/seat-statuses`
3. **Create Booking:** `/api/create-booking`
4. **Admin Functions:** `/api/admin/release-all-seats`

## 🔍 Step 4: Test Real-Time Features

### 4.1 WebSocket Testing

1. Open **Admin Panel** in one browser tab
2. Open **Student Interface** in another tab
3. Make changes in Admin Panel (book seats, pre-book, etc.)
4. Verify Student Interface updates in real-time

### 4.2 Browser Console Testing

Open browser developer tools and check for:
- Socket.IO connection status
- Real-time update events
- No WebSocket errors

## 🛠️ Step 5: Troubleshooting

### Common Issues

1. **Deployment Fails:**
   - Check Railway logs in the dashboard
   - Verify all dependencies are in `package.json`
   - Ensure `Dockerfile` is in the root directory

2. **WebSocket Not Working:**
   - Verify the app is using `0.0.0.0` as host
   - Check that `PORT` environment variable is set
   - Ensure Socket.IO is properly configured

3. **API Endpoints Not Responding:**
   - Check if the server is running
   - Verify CORS configuration
   - Check Railway logs for errors

### Debug Commands

```bash
# Check Railway logs
railway logs

# Check service status
railway status

# View environment variables
railway variables
```

<<<<<<< HEAD
## 🗄️ Step 6: Set Up Centralized Booking System

### 6.1 Run Database Migrations

1. Go to your Railway project dashboard
2. Click on your service
3. Go to "Deployments" tab
4. Click on the latest deployment
5. Click "View Logs"
6. Run the migration command:

```bash
# In Railway console or via CLI
railway run node scripts/migrate-to-centralized.js migrate
```

### 6.2 Verify Database Connection

1. Check that the `DATABASE_URL` environment variable is set
2. Verify the database connection in the logs
3. Confirm the bookings table was created

### 6.3 Test Centralized API

1. Use the Postman collection to test the new endpoints
2. Verify bookings are stored in the database
3. Check that real-time updates work with the centralized system

## 📊 Step 7: Monitoring
=======
## 📊 Step 6: Monitoring
>>>>>>> 74c9fcf316183f5cb92f50ddf6239ab0a7130e6a

### 6.1 Railway Dashboard

- Monitor CPU and memory usage
- Check deployment logs
- View real-time metrics

### 6.2 Application Monitoring

- Monitor WebSocket connections
- Track booking statistics
- Monitor API response times

## 🔄 Step 7: Updates and Maintenance

### 7.1 Deploy Updates

```bash
# Make changes to your code
git add .
git commit -m "Update: description of changes"
git push origin main

# Railway will automatically redeploy
```

### 7.2 Rollback if Needed

1. Go to Railway dashboard
2. Click on "Deployments"
3. Select a previous deployment
4. Click "Redeploy"

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Express.js Documentation](https://expressjs.com/)

## 🆘 Support

If you encounter issues:

1. Check Railway logs first
2. Verify all environment variables are set
3. Test locally with `npm start`
4. Check the Postman collection for API testing

## ✅ Deployment Checklist

- [ ] Git repository created and pushed to GitHub
- [ ] Railway project created and connected to GitHub
<<<<<<< HEAD
- [ ] PostgreSQL database service created
- [ ] Environment variables set (`NODE_ENV=production`, `PORT=3000`, `DATABASE_URL`)
- [ ] Application deployed successfully
- [ ] Database migrations run successfully
- [ ] Domain generated and accessible
- [ ] Centralized API endpoints responding correctly
- [ ] Legacy API endpoints working (backward compatibility)
- [ ] WebSocket connections working
- [ ] Real-time updates functioning
- [ ] Admin panel shows centralized data
- [ ] Student interface works with fallback
- [ ] Database persistence verified
- [ ] Postman collection tested successfully
- [ ] Concurrency testing completed
=======
- [ ] Environment variables set (`NODE_ENV=production`, `PORT=3000`)
- [ ] Application deployed successfully
- [ ] Domain generated and accessible
- [ ] API endpoints responding correctly
- [ ] WebSocket connections working
- [ ] Real-time updates functioning
- [ ] Admin panel accessible
- [ ] Student interface accessible
- [ ] Postman collection tested successfully
>>>>>>> 74c9fcf316183f5cb92f50ddf6239ab0a7130e6a

---

**🎉 Congratulations!** Your University Ticketing System is now live on Railway with full real-time functionality!
