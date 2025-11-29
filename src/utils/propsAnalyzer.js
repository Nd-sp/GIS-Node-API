const fs = require('fs');
const path = require('path');

/**
 * Props Analyzer - Analyzes React components and their prop connections
 * Scans .tsx files to extract:
 * - Component definitions
 * - Props interfaces
 * - Component connections via props
 */

class PropsAnalyzer {
  constructor(basePath) {
    this.basePath = basePath;
    this.components = new Map();
    this.propsInterfaces = new Map();
    this.connections = [];
    this.totalPropsCount = 0;
  }

  /**
   * Main analysis function
   */
  async analyze() {
    const startTime = Date.now();

    // Scan all .tsx files
    const files = this.getAllTsxFiles(this.basePath);

    for (const file of files) {
      await this.analyzeFile(file);
    }

    // Build connection graph
    this.buildConnectionGraph();

    const duration = Date.now() - startTime;

    return this.generateReport(duration);
  }

  /**
   * Get all .tsx files recursively
   */
  getAllTsxFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Skip node_modules and build directories
        if (!file.startsWith('.') && file !== 'node_modules' && file !== 'build' && file !== 'dist') {
          this.getAllTsxFiles(filePath, fileList);
        }
      } else if (file.endsWith('.tsx')) {
        fileList.push(filePath);
      }
    });

    return fileList;
  }

  /**
   * Analyze a single file
   */
  async analyzeFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(this.basePath, filePath);

      // Extract component name from file path
      const fileName = path.basename(filePath, '.tsx');

      // Find component definitions
      const componentMatches = this.findComponentDefinitions(content, fileName);

      // Find props interfaces
      const propsMatches = this.findPropsInterfaces(content);

      // Find component imports
      const imports = this.findComponentImports(content);

      // Find component usages (JSX tags)
      const usages = this.findComponentUsages(content);

      // Store component info
      componentMatches.forEach(comp => {
        this.components.set(comp.name, {
          name: comp.name,
          file: relativePath,
          propsInterface: comp.propsInterface,
          propsCount: 0,
          imports: imports,
          usages: usages,
          lineCount: content.split('\n').length,
          fileContent: content // Store for later prop usage analysis
        });
      });

      // Store props interfaces
      propsMatches.forEach(props => {
        // Analyze usage for each prop in the interface
        const propsWithUsage = props.props.map(prop => {
          const usage = this.analyzePropUsage(content, prop.name);
          return {
            ...prop,
            usageCount: usage.length,
            usages: usage.slice(0, 5), // Limit to first 5 usages
            usageSummary: this.extractPropUsageSummary(usage)
          };
        });

        this.propsInterfaces.set(props.name, {
          name: props.name,
          file: relativePath,
          props: propsWithUsage,
          propsCount: props.props.length
        });
        this.totalPropsCount += props.props.length;
      });

    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error.message);
    }
  }

  /**
   * Find component definitions (functional components)
   */
  findComponentDefinitions(content, fileName) {
    const components = [];

    // Pattern 1: const ComponentName: React.FC<PropsInterface> = (props) => {}
    const fcPattern1 = /(?:export\s+)?(?:const|function)\s+([A-Z][a-zA-Z0-9]*)\s*:\s*React\.FC(?:<([A-Z][a-zA-Z0-9]*)>)?/g;
    let match;
    while ((match = fcPattern1.exec(content)) !== null) {
      components.push({
        name: match[1],
        propsInterface: match[2] || null
      });
    }

    // Pattern 2: function ComponentName(props: PropsInterface) {}
    const funcPattern = /(?:export\s+)?(?:default\s+)?function\s+([A-Z][a-zA-Z0-9]*)\s*(?:<[^>]*>)?\s*\(\s*(?:{\s*[^}]*\s*}|[a-zA-Z0-9_]+)\s*:\s*([A-Z][a-zA-Z0-9]*)/g;
    while ((match = funcPattern.exec(content)) !== null) {
      components.push({
        name: match[1],
        propsInterface: match[2]
      });
    }

    // Pattern 3: const ComponentName = (props: PropsInterface) => {}
    const arrowPattern = /(?:export\s+)?const\s+([A-Z][a-zA-Z0-9]*)\s*=\s*\(\s*(?:{\s*[^}]*\s*}|[a-zA-Z0-9_]+)\s*:\s*([A-Z][a-zA-Z0-9]*)/g;
    while ((match = arrowPattern.exec(content)) !== null) {
      components.push({
        name: match[1],
        propsInterface: match[2]
      });
    }

    // If no components found but file is PascalCase, assume it's a component
    if (components.length === 0 && /^[A-Z]/.test(fileName)) {
      components.push({
        name: fileName,
        propsInterface: null
      });
    }

    return components;
  }

  /**
   * Find props interfaces/types
   */
  findPropsInterfaces(content) {
    const interfaces = [];

    // Pattern 1: interface ComponentProps { ... }
    const interfacePattern = /(?:export\s+)?interface\s+([A-Z][a-zA-Z0-9]*(?:Props|Properties)?)\s*(?:extends\s+[^{]+)?\s*{([^}]*)}/g;
    let match;
    while ((match = interfacePattern.exec(content)) !== null) {
      const props = this.parsePropsFromBlock(match[2]);
      interfaces.push({
        name: match[1],
        props: props
      });
    }

    // Pattern 2: type ComponentProps = { ... }
    const typePattern = /(?:export\s+)?type\s+([A-Z][a-zA-Z0-9]*(?:Props|Properties)?)\s*=\s*{([^}]*)}/g;
    while ((match = typePattern.exec(content)) !== null) {
      const props = this.parsePropsFromBlock(match[2]);
      interfaces.push({
        name: match[1],
        props: props
      });
    }

    return interfaces;
  }

  /**
   * Parse individual props from interface/type block
   */
  parsePropsFromBlock(block) {
    const props = [];
    const lines = block.split('\n');

    lines.forEach(line => {
      const trimmed = line.trim();
      // Match: propName: type or propName?: type
      const propMatch = /^([a-zA-Z0-9_]+)(\?)?:\s*(.+?);?$/;
      const match = propMatch.exec(trimmed);
      if (match) {
        props.push({
          name: match[1],
          optional: !!match[2],
          type: match[3].replace(/;$/, '').trim()
        });
      }
    });

    return props;
  }

  /**
   * Analyze prop usage within component code
   */
  analyzePropUsage(content, propName) {
    const usages = [];
    const lines = content.split('\n');

    lines.forEach((line, lineNumber) => {
      // Skip import/interface definitions
      if (line.includes('import ') || line.includes('interface ') || line.includes('type ')) {
        return;
      }

      // Pattern 1: Direct prop access - props.propName
      const directPattern = new RegExp(`\\bprops\\.${propName}\\b`, 'g');
      if (directPattern.test(line)) {
        usages.push({
          line: lineNumber + 1,
          context: this.detectUsageContext(line, propName),
          code: line.trim(),
          type: 'direct-access'
        });
      }

      // Pattern 2: Destructured prop usage
      const destructPattern = new RegExp(`\\b${propName}\\b(?!:)`, 'g');
      if (destructPattern.test(line) && !line.includes(`${propName}:`)) {
        usages.push({
          line: lineNumber + 1,
          context: this.detectUsageContext(line, propName),
          code: line.trim(),
          type: 'destructured'
        });
      }
    });

    return usages;
  }

  /**
   * Detect the context/purpose of prop usage
   */
  detectUsageContext(codeLine, propName) {
    const line = codeLine.toLowerCase();

    // Event handlers
    if (line.includes('onclick') || line.includes('onchange') || line.includes('onsubmit') ||
        line.includes('onkeypress') || line.includes('onkeydown') || line.includes('onblur')) {
      return 'Event Handler';
    }

    // Conditional rendering
    if (line.includes('if') || line.includes('?') || line.includes(':')) {
      return 'Conditional Logic';
    }

    // Rendering/Display
    if (line.includes('return') || line.includes('<') || line.includes('>')) {
      return 'Rendering/Display';
    }

    // State management
    if (line.includes('usestate') || line.includes('setstate') || line.includes('state')) {
      return 'State Management';
    }

    // API calls
    if (line.includes('fetch') || line.includes('axios') || line.includes('api')) {
      return 'API Call';
    }

    // Validation
    if (line.includes('valid') || line.includes('check') || line.includes('error')) {
      return 'Validation';
    }

    // Computation/Logic
    if (line.includes('const ') || line.includes('let ') || line.includes('=')) {
      return 'Computation';
    }

    return 'General Usage';
  }

  /**
   * Extract usage summary for a prop
   */
  extractPropUsageSummary(usages) {
    if (usages.length === 0) {
      return 'Not directly used (may be passed to child components)';
    }

    const contexts = usages.map(u => u.context);
    const uniqueContexts = [...new Set(contexts)];

    if (uniqueContexts.length === 1) {
      return `Used for ${uniqueContexts[0]} (${usages.length} occurrence${usages.length > 1 ? 's' : ''})`;
    }

    return `Used in multiple contexts: ${uniqueContexts.slice(0, 3).join(', ')} (${usages.length} total)`;
  }

  /**
   * Find component imports
   */
  findComponentImports(content) {
    const imports = [];

    // Match: import { Component1, Component2 } from './path'
    const importPattern = /import\s+(?:{([^}]+)}|([A-Z][a-zA-Z0-9]*))\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      if (match[1]) {
        // Named imports
        const names = match[1].split(',').map(n => n.trim()).filter(n => /^[A-Z]/.test(n));
        names.forEach(name => {
          imports.push({
            name: name,
            from: match[3]
          });
        });
      } else if (match[2]) {
        // Default import
        imports.push({
          name: match[2],
          from: match[3]
        });
      }
    }

    return imports;
  }

  /**
   * Find component usages in JSX
   */
  findComponentUsages(content) {
    const usages = [];

    // Match: <ComponentName ... />  or <ComponentName> ... </ComponentName>
    const jsxPattern = /<([A-Z][a-zA-Z0-9]*)/g;
    let match;
    while ((match = jsxPattern.exec(content)) !== null) {
      usages.push(match[1]);
    }

    // Remove duplicates
    return [...new Set(usages)];
  }

  /**
   * Build connection graph (which components use which)
   */
  buildConnectionGraph() {
    this.components.forEach((componentInfo, componentName) => {
      // Link props interface to component
      if (componentInfo.propsInterface && this.propsInterfaces.has(componentInfo.propsInterface)) {
        const propsInfo = this.propsInterfaces.get(componentInfo.propsInterface);
        componentInfo.propsCount = propsInfo.propsCount;
        componentInfo.propsList = propsInfo.props;
      }

      // Find which components this component uses
      componentInfo.usages.forEach(usedComponent => {
        // Check if this component was imported
        const isImported = componentInfo.imports.some(imp => imp.name === usedComponent);

        if (isImported || this.components.has(usedComponent)) {
          this.connections.push({
            from: componentName,
            to: usedComponent,
            type: 'uses'
          });
        }
      });
    });
  }

  /**
   * Generate analysis report
   */
  generateReport(duration) {
    // Calculate statistics
    const totalComponents = this.components.size;
    const totalInterfaces = this.propsInterfaces.size;
    const componentsWithProps = Array.from(this.components.values()).filter(c => c.propsCount > 0).length;
    const avgPropsPerComponent = totalInterfaces > 0 ? (this.totalPropsCount / totalInterfaces).toFixed(2) : 0;

    // Top components by props count
    const topComponentsByProps = Array.from(this.components.values())
      .filter(c => c.propsCount > 0)
      .sort((a, b) => b.propsCount - a.propsCount)
      .slice(0, 20)
      .map(c => ({
        name: c.name,
        file: c.file,
        propsCount: c.propsCount,
        propsInterface: c.propsInterface
      }));

    // Most connected components (most usages)
    const componentUsageCount = new Map();
    this.connections.forEach(conn => {
      componentUsageCount.set(conn.to, (componentUsageCount.get(conn.to) || 0) + 1);
    });

    const mostUsedComponents = Array.from(componentUsageCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({
        name,
        usedByCount: count,
        file: this.components.get(name)?.file || 'Unknown'
      }));

    // Component connection graph (for visualization)
    const connectionGraph = this.connections.map(conn => ({
      from: conn.from,
      to: conn.to,
      fromFile: this.components.get(conn.from)?.file || 'Unknown',
      toFile: this.components.get(conn.to)?.file || 'Unknown'
    }));

    // Detailed component list
    const componentDetails = Array.from(this.components.values()).map(c => ({
      name: c.name,
      file: c.file,
      propsInterface: c.propsInterface || 'None',
      propsCount: c.propsCount,
      props: c.propsList || [],
      uses: c.usages.length,
      lineCount: c.lineCount
    }));

    // Props interface details
    const propsDetails = Array.from(this.propsInterfaces.values()).map(p => ({
      name: p.name,
      file: p.file,
      propsCount: p.propsCount,
      props: p.props
    }));

    return {
      summary: {
        totalComponents,
        totalPropsInterfaces: totalInterfaces,
        totalPropsCount: this.totalPropsCount,
        componentsWithProps,
        avgPropsPerComponent: parseFloat(avgPropsPerComponent),
        totalConnections: this.connections.length,
        analysisDuration: `${duration}ms`
      },
      topComponentsByProps,
      mostUsedComponents,
      connectionGraph,
      componentDetails,
      propsDetails,
      mermaidDiagram: this.generateMermaidDiagram()
    };
  }

  /**
   * Generate Mermaid diagram for visualization
   */
  generateMermaidDiagram() {
    let diagram = 'graph TD\n';

    // Limit to top 30 connections to avoid overcrowding
    const topConnections = this.connections.slice(0, 30);

    topConnections.forEach(conn => {
      const fromId = conn.from.replace(/[^a-zA-Z0-9]/g, '_');
      const toId = conn.to.replace(/[^a-zA-Z0-9]/g, '_');
      diagram += `  ${fromId}["${conn.from}"] --> ${toId}["${conn.to}"]\n`;
    });

    return diagram;
  }
}

/**
 * Run props analysis
 */
async function analyzeProps(frontendPath) {
  const analyzer = new PropsAnalyzer(frontendPath);
  return await analyzer.analyze();
}

module.exports = { analyzeProps, PropsAnalyzer };
