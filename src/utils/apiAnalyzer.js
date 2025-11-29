const fs = require('fs');
const path = require('path');

/**
 * API Performance Analyzer - Analyzes API endpoints and their usage
 * Scans backend routes and frontend services to extract:
 * - API endpoints (method, path, controller)
 * - Request/Response data structures
 * - Frontend service mappings
 * - Performance characteristics
 */

class APIAnalyzer {
  constructor(backendPath, frontendPath) {
    this.backendPath = backendPath;
    this.frontendPath = frontendPath;
    this.routes = [];
    this.controllers = new Map();
    this.services = new Map();
    this.apiMap = new Map();
  }

  /**
   * Main analysis function
   */
  async analyze() {
    const startTime = Date.now();

    // 1. Scan backend routes
    await this.scanBackendRoutes();

    // 2. Scan backend controllers
    await this.scanBackendControllers();

    // 3. Scan frontend services
    await this.scanFrontendServices();

    // 4. Build API map (connect frontend to backend)
    this.buildAPIMap();

    const duration = Date.now() - startTime;

    return this.generateReport(duration);
  }

  /**
   * Scan backend route files
   */
  async scanBackendRoutes() {
    const routesDir = path.join(this.backendPath, 'src', 'routes');
    if (!fs.existsSync(routesDir)) {
      console.warn('Routes directory not found:', routesDir);
      return;
    }

    const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

    for (const file of files) {
      const filePath = path.join(routesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Extract route definitions
      const endpoints = this.extractEndpoints(content, file);
      this.routes.push(...endpoints);
    }
  }

  /**
   * Extract API endpoints from route file
   */
  extractEndpoints(content, fileName) {
    const endpoints = [];
    const lines = content.split('\n');

    lines.forEach((line, lineNumber) => {
      // Match: router.get('/path', middleware, controller.method)
      const routePattern = /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:.*?,)?\s*([a-zA-Z0-9_.]+)\s*\)/;
      const match = routePattern.exec(line);

      if (match) {
        const method = match[1].toUpperCase();
        const path = match[2];
        const handler = match[3];

        // Extract middleware (checkPermission, authenticate, etc.)
        const middlewareMatch = /checkPermission\(['"`]([^'"`]+)['"`]\)/.exec(line);
        const permission = middlewareMatch ? middlewareMatch[1] : null;

        const authenticateMatch = /authenticate/.test(line);

        endpoints.push({
          method,
          path,
          handler,
          permission,
          requiresAuth: authenticateMatch,
          file: fileName,
          line: lineNumber + 1
        });
      }
    });

    return endpoints;
  }

  /**
   * Scan backend controller files
   */
  async scanBackendControllers() {
    const controllersDir = path.join(this.backendPath, 'src', 'controllers');
    if (!fs.existsSync(controllersDir)) {
      console.warn('Controllers directory not found:', controllersDir);
      return;
    }

    const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));

    for (const file of files) {
      const filePath = path.join(controllersDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Extract controller methods and their logic
      const methods = this.extractControllerMethods(content, file);
      this.controllers.set(file, methods);
    }
  }

  /**
   * Extract controller methods and analyze what they do
   */
  extractControllerMethods(content, fileName) {
    const methods = [];

    // Pattern: exports.methodName = async (req, res) => { ... }
    const methodPattern = /exports\.([a-zA-Z0-9_]+)\s*=\s*async\s*\([^)]*\)\s*=>\s*{/g;
    let match;

    while ((match = methodPattern.exec(content)) !== null) {
      const methodName = match[1];
      const startPos = match.index;

      // Extract method body (simplified - gets next 500 chars)
      const methodBody = content.substring(startPos, startPos + 1000);

      methods.push({
        name: methodName,
        file: fileName,
        requestData: this.analyzeRequestData(methodBody),
        responseData: this.analyzeResponseData(methodBody),
        databaseQueries: this.analyzeDatabaseQueries(methodBody),
        validations: this.analyzeValidations(methodBody)
      });
    }

    return methods;
  }

  /**
   * Analyze what request data the endpoint expects
   */
  analyzeRequestData(methodBody) {
    const requestData = [];

    // req.body
    if (methodBody.includes('req.body')) {
      const bodyPattern = /req\.body\.([a-zA-Z0-9_]+)/g;
      let match;
      while ((match = bodyPattern.exec(methodBody)) !== null) {
        if (!requestData.includes(match[1])) {
          requestData.push(match[1]);
        }
      }
    }

    // req.params
    if (methodBody.includes('req.params')) {
      const paramsPattern = /req\.params\.([a-zA-Z0-9_]+)/g;
      let match;
      while ((match = paramsPattern.exec(methodBody)) !== null) {
        requestData.push(`${match[1]} (param)`);
      }
    }

    // req.query
    if (methodBody.includes('req.query')) {
      const queryPattern = /req\.query\.([a-zA-Z0-9_]+)/g;
      let match;
      while ((match = queryPattern.exec(methodBody)) !== null) {
        requestData.push(`${match[1]} (query)`);
      }
    }

    return requestData.slice(0, 10); // Limit to first 10
  }

  /**
   * Analyze what response data the endpoint returns
   */
  analyzeResponseData(methodBody) {
    const responses = [];

    // res.json({ ... })
    const jsonPattern = /res\.json\s*\(\s*{([^}]+)}/g;
    let match;
    while ((match = jsonPattern.exec(methodBody)) !== null) {
      const keys = match[1]
        .split(',')
        .map(s => s.trim().split(':')[0].trim())
        .filter(k => k && !k.startsWith('//'));
      responses.push(...keys);
    }

    // res.status(200).json(...)
    const statusPattern = /res\.status\s*\(\s*(\d+)\s*\)/g;
    const statusMatches = [...methodBody.matchAll(statusPattern)];
    const statusCodes = statusMatches.map(m => m[1]);

    return {
      data: [...new Set(responses)].slice(0, 10),
      statusCodes: [...new Set(statusCodes)]
    };
  }

  /**
   * Analyze database queries in the endpoint
   */
  analyzeDatabaseQueries(methodBody) {
    const queries = [];

    // db.query or pool.query
    if (methodBody.includes('.query')) {
      const queryPattern = /(SELECT|INSERT|UPDATE|DELETE)\s+/gi;
      const matches = [...methodBody.matchAll(queryPattern)];
      queries.push(...matches.map(m => m[1].toUpperCase()));
    }

    return [...new Set(queries)];
  }

  /**
   * Analyze validations in the endpoint
   */
  analyzeValidations(methodBody) {
    const validations = [];

    if (methodBody.includes('if (!') || methodBody.includes('if(!')) {
      validations.push('Input validation');
    }

    if (methodBody.includes('validate') || methodBody.includes('schema')) {
      validations.push('Schema validation');
    }

    if (methodBody.includes('sanitize')) {
      validations.push('Input sanitization');
    }

    return validations;
  }

  /**
   * Scan frontend service files
   */
  async scanFrontendServices() {
    const servicesDir = path.join(this.frontendPath, 'src', 'services');
    if (!fs.existsSync(servicesDir)) {
      console.warn('Services directory not found:', servicesDir);
      return;
    }

    const files = fs.readdirSync(servicesDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

    for (const file of files) {
      const filePath = path.join(servicesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Extract API calls from service
      const apiCalls = this.extractFrontendAPICalls(content, file);
      this.services.set(file, apiCalls);
    }
  }

  /**
   * Extract API calls from frontend service
   */
  extractFrontendAPICalls(content, fileName) {
    const apiCalls = [];

    // Pattern 1: axios.get('/api/path')
    const axiosPattern = /axios\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;

    while ((match = axiosPattern.exec(content)) !== null) {
      apiCalls.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: fileName,
        type: 'axios'
      });
    }

    // Pattern 2: apiClient.get('/path')
    const apiClientPattern = /apiClient\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    while ((match = apiClientPattern.exec(content)) !== null) {
      apiCalls.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: fileName,
        type: 'apiClient'
      });
    }

    return apiCalls;
  }

  /**
   * Build API map connecting frontend to backend
   */
  buildAPIMap() {
    // Match frontend service calls to backend routes
    this.services.forEach((apiCalls, serviceFile) => {
      apiCalls.forEach(call => {
        // Find matching backend route
        const matchingRoute = this.routes.find(route => {
          // Normalize paths for comparison
          const routePath = route.path.replace(/:\w+/g, '[param]');
          const callPath = call.path.replace(/\$\{[^}]+\}/g, '[param]').replace(/\d+/g, '[param]');

          return route.method === call.method &&
                 (routePath === callPath || route.path.includes(call.path) || call.path.includes(route.path));
        });

        if (matchingRoute) {
          const key = `${matchingRoute.method} ${matchingRoute.path}`;

          if (!this.apiMap.has(key)) {
            this.apiMap.set(key, {
              backend: matchingRoute,
              frontend: [],
              controllerData: null
            });
          }

          this.apiMap.get(key).frontend.push({
            service: serviceFile,
            ...call
          });

          // Add controller data if available
          const controllerFile = matchingRoute.handler.split('.')[0] + 'Controller.js';
          const controllerMethods = this.controllers.get(controllerFile);
          if (controllerMethods) {
            const methodName = matchingRoute.handler.split('.')[1];
            const method = controllerMethods.find(m => m.name === methodName);
            if (method) {
              this.apiMap.get(key).controllerData = method;
            }
          }
        }
      });
    });
  }

  /**
   * Generate analysis report
   */
  generateReport(duration) {
    const endpoints = Array.from(this.apiMap.entries()).map(([key, data]) => {
      const [method, path] = key.split(' ', 2);

      return {
        method,
        path,
        handler: data.backend.handler,
        permission: data.backend.permission,
        requiresAuth: data.backend.requiresAuth,
        backendFile: data.backend.file,
        frontendServices: data.frontend.map(f => f.service),
        usageCount: data.frontend.length,
        requestData: data.controllerData?.requestData || [],
        responseData: data.controllerData?.responseData || { data: [], statusCodes: [] },
        databaseQueries: data.controllerData?.databaseQueries || [],
        validations: data.controllerData?.validations || []
      };
    });

    // Calculate statistics
    const totalEndpoints = endpoints.length;
    const totalBackendRoutes = this.routes.length;
    const totalFrontendCalls = Array.from(this.services.values()).reduce((sum, calls) => sum + calls.length, 0);
    const authRequired = endpoints.filter(e => e.requiresAuth).length;
    const withPermissions = endpoints.filter(e => e.permission).length;

    // Group by HTTP method
    const byMethod = {};
    endpoints.forEach(e => {
      byMethod[e.method] = (byMethod[e.method] || 0) + 1;
    });

    // Most used endpoints
    const mostUsed = [...endpoints]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 20);

    // Unused backend routes
    const usedPaths = new Set(endpoints.map(e => e.path));
    const unusedRoutes = this.routes.filter(r => !usedPaths.has(r.path));

    return {
      summary: {
        totalEndpoints,
        totalBackendRoutes,
        totalFrontendCalls,
        mappedEndpoints: endpoints.length,
        unmappedRoutes: unusedRoutes.length,
        authRequired,
        withPermissions,
        byMethod,
        analysisDuration: `${duration}ms`
      },
      endpoints: endpoints.sort((a, b) => a.path.localeCompare(b.path)),
      mostUsedEndpoints: mostUsed,
      unusedRoutes: unusedRoutes.slice(0, 20),
      serviceFiles: Array.from(this.services.keys()),
      routeFiles: [...new Set(this.routes.map(r => r.file))]
    };
  }
}

/**
 * Run API analysis
 */
async function analyzeAPIs(backendPath, frontendPath) {
  const analyzer = new APIAnalyzer(backendPath, frontendPath);
  return await analyzer.analyze();
}

module.exports = { analyzeAPIs, APIAnalyzer };
