# Azure React App with Node.js Backend Setup Checklist

## 1. Frontend Setup (React)
- [ ] Initialize React app with `npx create-react-app my-app`
- [ ] Configure project structure (src, components, pages, assets)
- [ ] Set up routing (e.g., react-router)
- [ ] Install necessary dependencies (axios, state management, etc.)

## 2. Backend Setup (Node.js + Express)
- [ ] Create backend directory (e.g., `/server`)
- [ ] Initialize Node.js project: `npm init -y`
- [ ] Install Express and other dependencies (`npm install express cors dotenv`)
- [ ] Set up basic API routes and controllers
- [ ] Implement connection to database (Azure SQL, MongoDB, or Cosmos DB)
- [ ] Configure environment variables with `.env`
- [ ] Implement authentication (optional)

## 3. Integration
- [ ] Configure API calls from React to Express backend
- [ ] Set up CORS in Express for frontend communication
- [ ] Test local integration (API calls, authentication, CRUD operations)

## 4. Azure Setup
- [ ] Create Azure account and log in to Azure Portal
- [ ] Set up separate resource groups for frontend and backend (optional)
- [ ] Deploy React frontend as Azure Static Web App or Azure App Service
- [ ] Deploy Node.js backend as Azure App Service or Azure Functions (serverless)
- [ ] Set up databases (Azure SQL, MongoDB Atlas, or Cosmos DB)
- [ ] Configure backend to use environment variables for secrets, DB credentials

## 5. CI/CD Configuration
- [ ] Configure GitHub Actions or Azure Pipelines for automatic deployments
- [ ] Add workflow files for build and deploy steps
- [ ] Set up testing workflow (Jest for React, Mocha/Jest for Node)

## 6. Post-Deployment
- [ ] Set up monitoring tools (Azure Monitor, Application Insights)
- [ ] Add custom domains (optional)
- [ ] Configure SSL/TLS for secure communication
- [ ] Set up proper scaling options for both frontend and backend

## 7. Security & Best Practices
- [ ] Store secrets in Azure Key Vault
- [ ] Apply best security practices for Node.js and React
- [ ] Regularly review and update dependencies

---

**You can use this list with GitHub Copilot agents to automate or guide setup, coding, and deployment tasks.**