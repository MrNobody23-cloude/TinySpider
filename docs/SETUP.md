# Setup Guide - TinySpider Analytics Platform

## Prerequisites

- **Node.js**: 18.x or higher
- **npm**: 8.x or higher
- **Docker & Docker Compose**: (optional, for containerized deployment)
- **Git**: For version control

## Local Development Setup

### Step 1: Clone and Install Dependencies

```bash
# Navigate to project root
cd TinySpider-main

# Install all dependencies
npm install:all
```

This command installs dependencies for:
- Root workspace
- Frontend packages (dashboard, tracker, demo-site)
- Backend packages (api)

### Step 2: Environment Configuration

Copy and configure the environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Backend Configuration
PORT=3000
LOG_LEVEL=info
NODE_ENV=development

# Security (Change in production!)
IP_HASH_SALT=your-random-hash-salt-here
JWT_SECRET=your-random-jwt-secret-here
BCRYPT_ROUNDS=12

# API CORS
API_CORS_ORIGINS=http://localhost,http://localhost:5173,http://localhost:80

# Databases
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DATABASE=default
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=insightdb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
REDIS_URL=redis://localhost:6379

# Optional: GeoIP Database
GEOIP_MMDB_PATH=/path/to/GeoLite2-City.mmdb
```

### Step 3: Start Databases

#### Option A: Using Docker

```bash
# Start all services (ClickHouse, PostgreSQL, Redis)
docker-compose up -d
```

#### Option B: Using Local Services

Ensure these services are running on your machine:
- **ClickHouse**: Port 8123
- **PostgreSQL**: Port 5432
- **Redis**: Port 6379

### Step 4: Build Tracker

```bash
npm run build:tracker
```

This creates the minified tracker script at `frontend/packages/tracker/dist/insight.min.js`.

### Step 5: Start Development Servers

Choose your approach:

#### Option 1: All Services in One Command

```bash
npm run dev
```

This starts:
- Backend API (port 3000)
- Frontend Dashboard (port 5173)
- Demo site (port 5175)

#### Option 2: Separate Terminals

Terminal 1 - Backend API:
```bash
npm run dev:backend
# or
npm --workspace backend/packages/api run start
```

Terminal 2 - Frontend Dashboard:
```bash
npm run dev:frontend
# or
npm --workspace frontend/packages/dashboard run dev
```

Terminal 3 - Demo Site (optional):
```bash
npm run dev:demo
# or
npm --workspace frontend/packages/demo-site run dev
```

### Step 6: Access the Applications

- **Dashboard**: http://localhost:5173
- **API**: http://localhost:3000
- **Demo Site**: http://localhost:5175 (optional)
- **ClickHouse UI**: http://localhost:8123

## Docker Compose Setup (Complete Stack)

For the full integrated stack with all services:

```bash
# Start the entire stack
npm run start:docker

# View logs
npm run logs:docker

# Stop the stack
npm run stop:docker
```

This includes:
- ClickHouse database
- PostgreSQL database
- Redis cache
- Node.js API server
- React dashboard
- Nginx reverse proxy

## Testing

### Run All Tests

```bash
npm run test:all
```

### Run API Tests Only

```bash
npm run test:api
```

### Run Dashboard Tests Only

```bash
npm run test:dashboard
```

### Watch Mode (for development)

```bash
npm run test:watch
```

## Building for Production

### Build All Packages

```bash
npm run build:all
```

### Build Individual Packages

```bash
# Frontend
npm run build:frontend

# Backend
npm run build:backend

# Tracker
npm run build:tracker
```

## Database Migrations

Run database migrations (if needed):

```bash
npm run migrate
```

This initializes or updates the database schemas in ClickHouse and PostgreSQL.

## Troubleshooting Setup Issues

### Issue: `workspaces` error

**Solution**: Ensure npm version 8.0 or higher:
```bash
npm --version
npm install -g npm@latest
```

### Issue: Port already in use

**Solution**: Change ports in `.env`:
```env
PORT=3001  # Change from 3000
```

### Issue: Database connection error

**Solution**: Ensure databases are running and accessible:
```bash
# Test ClickHouse
curl http://localhost:8123/ping

# Test PostgreSQL
psql -U postgres -d insightdb -c "SELECT 1"

# Test Redis
redis-cli ping
```

### Issue: Missing environment variables

**Solution**: Verify `.env` file exists and is sourced:
```bash
ls -la .env
# Should output the .env file
```

## Next Steps

1. **Integration**: See [INTEGRATION.md](INTEGRATION.md) for adding the tracker to your website
2. **API Usage**: Check [API.md](API.md) for available endpoints
3. **Architecture**: Review [ARCHITECTURE.md](ARCHITECTURE.md) for system design
4. **Deployment**: Read [DEPLOYMENT.md](DEPLOYMENT.md) for production setup

## Support

For more detailed information:
- Architecture overview: See [ARCHITECTURE.md](ARCHITECTURE.md)
- Database setup: See [DATABASE.md](DATABASE.md)
- Security considerations: See [SECURITY.md](SECURITY.md)
- Common problems: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
