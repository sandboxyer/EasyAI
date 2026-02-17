// HF.js - Vanilla Node.js, zero dependencies
import https from 'https';
import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

/**
 * Hugging Face API wrapper - Vanilla Node.js implementation
 * All methods are static and can be used without instantiation
 */
export default class HF {
  // ============================================
  // CONFIGURATION
  // ============================================

  static DEFAULT_CONFIG = {
    baseUrl: 'https://huggingface.co/models',
    sortBy: 'downloads',
    search: 'gguf',
    pipelineTag: null,
    page: 1,
    itemsPerPage: 30
  };

  // Cache for loaded pages (key: page number, value: {models, timestamp})
  static pageCache = new Map();
  static CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  // Active downloads tracker for cancellation
  static activeDownloads = new Map();

  // ============================================
  // PART 1: MODEL LIST PARSER WITH PAGINATION
  // ============================================

  /**
   * Builds a Hugging Face models URL with pagination and filters
   * @param {Object} config - Configuration object
   * @returns {string} - Constructed URL
   */
  static buildModelsUrl(config = {}) {
    const params = new URLSearchParams();
    
    // Merge with defaults
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    // Add search query
    if (finalConfig.search) {
      params.append('search', finalConfig.search);
    }
    
    // Add sorting
    if (finalConfig.sortBy) {
      params.append('sort', finalConfig.sortBy);
    }
    
    // Add pipeline tag if specified
    if (finalConfig.pipelineTag) {
      params.append('pipeline_tag', finalConfig.pipelineTag);
    }
    
    // Add pagination - Hugging Face uses p=1 for page 1, p=2 for page 2, etc.
    if (finalConfig.page > 1) {
      params.append('p', finalConfig.page);
    }
    
    const queryString = params.toString();
    return queryString ? `${finalConfig.baseUrl}?${queryString}` : finalConfig.baseUrl;
  }

  /**
   * Fetches HTML content from a URL
   * @param {string} urlString - The URL to fetch
   * @returns {Promise<string>} - HTML content
   */
  static async fetchHTML(urlString) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(urlString);
      
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HF-API/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      };

      const req = https.get(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve(data);
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Error fetching URL: ${error.message}`));
      });
      
      req.end();
    });
  }

  /**
   * Fetches models from a specific page with caching
   * @param {Object} config - Configuration object
   * @param {boolean} forceRefresh - Skip cache and force refresh
   * @returns {Promise<Object>} - { models, pagination }
   */
  static async fetchModelsPage(config = {}, forceRefresh = false) {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const urlString = this.buildModelsUrl(finalConfig);
    const pageKey = `${finalConfig.search}_${finalConfig.sortBy}_${finalConfig.page}`;
    
    // Check cache if not forcing refresh
    if (!forceRefresh && this.pageCache.has(pageKey)) {
      const cached = this.pageCache.get(pageKey);
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log(`📦 Using cached data for page ${finalConfig.page}`);
        return cached.data;
      }
      this.pageCache.delete(pageKey);
    }
    
    console.log(`🌐 Fetching page ${finalConfig.page}: ${urlString}`);
    
    try {
      const html = await this.fetchHTML(urlString);
      const result = this.parseModelsPage(html, finalConfig.page);
      
      // Store in cache
      this.pageCache.set(pageKey, {
        timestamp: Date.now(),
        data: result
      });
      
      return result;
    } catch (error) {
      throw new Error(`Error fetching models page: ${error.message}`);
    }
  }

  /**
   * Parses a models page and extracts pagination info
   * @param {string} html - The HTML content
   * @param {number} requestedPage - The page that was requested
   * @returns {Object} - { models, pagination }
   */
  static parseModelsPage(html, requestedPage) {
    const models = [];
    
    // Extract total items count from the page (if available)
    let totalItems = null;
    const totalItemsRegex = /window\.__hf_deferred\["numTotalItems"\]\s*=\s*(\d+);/;
    const totalMatch = html.match(totalItemsRegex);
    if (totalMatch) {
      totalItems = parseInt(totalMatch[1], 10);
    }
    
    // Find pagination information
    const pagination = this.extractPaginationInfo(html, requestedPage, totalItems);
    
    // Find all model articles
    const articleRegex = /<article[^>]*class="[^"]*overview-card-wrapper[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
    let articleMatch;
    
    while ((articleMatch = articleRegex.exec(html)) !== null) {
      const articleContent = articleMatch[1];
      
      try {
        const model = this.parseModelArticle(articleContent);
        if (model) {
          models.push(model);
        }
      } catch (err) {
        // Skip problematic articles
      }
    }
    
    return {
      models,
      pagination: {
        currentPage: pagination.currentPage,
        totalPages: pagination.totalPages,
        totalItems: pagination.totalItems,
        hasNextPage: pagination.hasNextPage,
        hasPrevPage: pagination.hasPrevPage,
        itemsPerPage: this.DEFAULT_CONFIG.itemsPerPage,
        requestedPage
      }
    };
  }

  /**
   * Extracts pagination information from HTML
   * @param {string} html - The HTML content
   * @param {number} requestedPage - The page that was requested
   * @param {number|null} totalItems - Total items if known
   * @returns {Object} - Pagination info
   */
  static extractPaginationInfo(html, requestedPage, totalItems = null) {
    // Look for pagination links
    const pageLinks = [];
    const paginationRegex = /<a[^>]*href="[^"]*[?&]p=(\d+)[^"]*"[^>]*>(\d+)<\/a>/g;
    let match;
    
    while ((match = paginationRegex.exec(html)) !== null) {
      pageLinks.push(parseInt(match[1], 10));
    }
    
    // Find the maximum page number from links
    let maxPage = Math.max(...pageLinks, requestedPage);
    
    // Check for "next" button to determine if there are more pages
    const hasNextRegex = /<a[^>]*rel="next"[^>]*>/;
    const hasNext = hasNextRegex.test(html);
    
    // Check for "previous" button
    const hasPrevRegex = /<a[^>]*rel="prev"[^>]*>/;
    const hasPrev = hasPrevRegex.test(html);
    
    // Determine current page - look for active page indicator
    let currentPage = requestedPage;
    const currentRegex = /<span[^>]*class="[^"]*active[^"]*"[^>]*>(\d+)<\/span>/;
    const currentMatch = html.match(currentRegex);
    if (currentMatch) {
      currentPage = parseInt(currentMatch[1], 10);
    }
    
    // If we have total items, calculate total pages
    if (totalItems) {
      maxPage = Math.ceil(totalItems / this.DEFAULT_CONFIG.itemsPerPage);
    } else if (hasNext) {
      // If there's a next button and we found page links, use the max from links + 1
      maxPage = Math.max(maxPage, requestedPage + 1);
    }
    
    return {
      currentPage,
      totalPages: maxPage,
      totalItems,
      hasNextPage: hasNext || currentPage < maxPage,
      hasPrevPage: hasPrev || currentPage > 1
    };
  }

  /**
   * Parses a single model article
   * @param {string} articleContent - HTML content of the article
   * @returns {Object|null} - Model object or null if parsing failed
   */
  static parseModelArticle(articleContent) {
    // Extract model URL
    const urlRegex = /<a[^>]*href="([^"]*)"[^>]*>/;
    const urlMatch = articleContent.match(urlRegex);
    const modelPath = urlMatch ? urlMatch[1] : '';
    const modelUrl = modelPath.startsWith('http') 
      ? modelPath 
      : `https://huggingface.co${modelPath}`;
    
    // Extract author and model name
    const pathParts = modelPath.split('/');
    const author = pathParts[1] || '';
    let modelName = pathParts[2] || '';
    
    // Get full model name from header
    const headerRegex = /<header[^>]*>[\s\S]*?<h4[^>]*class="[^"]*"[^>]*>([^<]+)<\/h4>/;
    const headerMatch = articleContent.match(headerRegex);
    const fullModelName = headerMatch ? headerMatch[1].trim() : `${author}/${modelName}`;
    
    // If modelName is empty, extract from fullModelName
    if (!modelName && fullModelName.includes('/')) {
      modelName = fullModelName.split('/')[1];
    }
    
    // Extract avatar URL
    const avatarRegex = /<img[^>]*class="[^"]*size-3\.5[^"]*"[^>]*src="([^"]*)"[^>]*>/;
    const avatarMatch = articleContent.match(avatarRegex);
    const avatarUrl = avatarMatch ? avatarMatch[1] : '';
    
    // Extract task
    const taskRegex = /<svg[^>]*class="[^"]*text-\[\.8rem\][^"]*"[^>]*>[\s\S]*?<\/svg>\s*([^<\s][^<]*?)(?=<|$)/;
    const taskMatch = articleContent.match(taskRegex);
    const task = taskMatch ? taskMatch[1].trim() : 'Unknown';
    
    // Extract parameters
    const paramsRegex = /<span[^>]*title="Number of parameters[^"]*"[^>]*>[\s\S]*?<svg[^>]*>[\s\S]*?<\/svg>\s*([^<\s][^<]*?)(?=<|$)/;
    const paramsMatch = articleContent.match(paramsRegex);
    const parameters = paramsMatch ? paramsMatch[1].trim() : null;
    
    // Extract downloads
    const downloadsRegex = /<svg[^>]*viewBox="0 0 32 32"[^>]*>[\s\S]*?<\/svg>\s*([\d.]+[kM]?)/;
    const downloadsMatch = articleContent.match(downloadsRegex);
    let downloads = 0;
    if (downloadsMatch) {
      downloads = this.parseMetricNumber(downloadsMatch[1].trim());
    }
    
    // Extract likes
    const likesRegex = /<svg[^>]*viewBox="0 0 32 32"[^>]*fill="currentColor"[^>]*>[\s\S]*?<\/svg>\s*([\d.]+k?)/;
    const likesMatch = articleContent.match(likesRegex);
    let likes = 0;
    if (likesMatch) {
      likes = this.parseMetricNumber(likesMatch[1].trim());
    }
    
    // Extract last updated
    const timeRegex = /<time[^>]*datetime="([^"]*)"[^>]*>([^<]+)<\/time>/;
    const timeMatch = articleContent.match(timeRegex);
    const lastUpdated = timeMatch ? (timeMatch[1] || timeMatch[2].trim()) : '';
    
    // Check for inference
    const inferenceRegex = /<svg[^>]*class="[^"]*text-yellow-400[^"]*"[^>]*>/;
    const hasInference = inferenceRegex.test(articleContent);
    
    // Check if it's a GGUF model
    const isGGUF = articleContent.includes('GGUF') || 
                   articleContent.toLowerCase().includes('.gguf') ||
                   articleContent.includes('library=gguf');
    
    return {
      author,
      modelName,
      fullName: fullModelName,
      url: modelUrl,
      avatarUrl,
      task,
      parameters,
      downloads,
      likes,
      lastUpdated,
      hasInference,
      isGGUF,
      metadata: {
        authorProfile: author ? `https://huggingface.co/${author}` : null,
        modelPath
      }
    };
  }

  /**
   * Parses metric numbers with K, M suffixes
   * @param {string} text - The text containing a metric number
   * @returns {number} - The parsed number
   */
  static parseMetricNumber(text) {
    if (!text) return 0;
    
    const match = text.match(/^([\d.]+)([kM]?)$/);
    if (!match) return 0;
    
    const num = parseFloat(match[1]);
    const suffix = match[2];
    
    switch (suffix) {
      case 'k':
        return num * 1000;
      case 'M':
        return num * 1000000;
      default:
        return num;
    }
  }

  /**
   * Fetches multiple pages of models
   * @param {Object} config - Base configuration
   * @param {number} startPage - Starting page number
   * @param {number} endPage - Ending page number (inclusive)
   * @param {boolean} parallel - Fetch pages in parallel
   * @returns {Promise<Array>} - Combined array of models from all pages
   */
  static async fetchModelsPages(config = {}, startPage = 1, endPage = 1, parallel = false) {
    const allModels = [];
    const pages = [];
    
    for (let page = startPage; page <= endPage; page++) {
      pages.push({ ...config, page });
    }
    
    if (parallel) {
      // Fetch all pages in parallel
      const results = await Promise.all(pages.map(pageConfig => this.fetchModelsPage(pageConfig)));
      results.forEach(result => {
        allModels.push(...result.models);
      });
    } else {
      // Fetch pages sequentially
      for (const pageConfig of pages) {
        const result = await this.fetchModelsPage(pageConfig);
        allModels.push(...result.models);
        console.log(`📊 Page ${pageConfig.page}: ${result.models.length} models found`);
      }
    }
    
    return allModels;
  }

  // ============================================
  // PART 2: GGUF FILE FINDER
  // ============================================

  /**
   * Normalizes a Hugging Face URL to ensure it points to the tree view
   * @param {string} urlString - The URL to normalize
   * @returns {string} - Normalized URL with /tree/main
   */
  static normalizeTreeUrl(urlString) {
    // Remove any trailing slashes
    let cleanUrl = urlString.replace(/\/+$/, '');
    
    // If URL already contains /tree/, return as is
    if (cleanUrl.includes('/tree/')) {
      return cleanUrl;
    }
    
    // If URL ends with /tree/main or similar, ensure it's correct
    if (cleanUrl.match(/\/tree\/[^\/]+$/)) {
      return cleanUrl;
    }
    
    // Remove /tree/main if present in the middle
    cleanUrl = cleanUrl.replace(/\/tree\/[^\/]+/, '');
    
    // Remove /blob/... if present
    cleanUrl = cleanUrl.replace(/\/blob\/[^\/]+(\/[^\/]+)?$/, '');
    
    // Remove /resolve/... if present
    cleanUrl = cleanUrl.replace(/\/resolve\/[^\/]+(\/[^\/]+)?$/, '');
    
    // Ensure we have the base model URL and add /tree/main
    return `${cleanUrl}/tree/main`;
  }

  /**
   * Recursively finds all .gguf files in a Hugging Face repository
   * @param {string} baseUrl - The base URL of the model (will be normalized)
   * @param {string} currentPath - Current path being scanned (for recursion)
   * @param {Array} results - Accumulator for found files
   * @returns {Promise<Array>} - Array of .gguf file objects
   */
  static async findGGUFFiles(baseUrl, currentPath = '', results = []) {
    try {
      // Normalize the base URL once
      const normalizedBase = !currentPath ? this.normalizeTreeUrl(baseUrl) : baseUrl;
      
      // Construct the full URL for this path
      const fullUrl = currentPath 
        ? `${normalizedBase.replace(/\/tree\/main$/, '')}/tree/main/${currentPath}`
        : normalizedBase;
      
      console.log(`🔍 Scanning: ${fullUrl}`);
      const html = await this.fetchHTML(fullUrl);
      
      // Parse directories and files from the current page
      const entries = this.parseTreeEntries(html, currentPath);
      
      // Process each entry
      for (const entry of entries) {
        if (entry.type === 'directory') {
          // Recursively scan subdirectories
          const subPath = currentPath 
            ? `${currentPath}/${entry.name}`
            : entry.name;
          await this.findGGUFFiles(normalizedBase, subPath, results);
        } else if (entry.type === 'file' && entry.name.toLowerCase().endsWith('.gguf')) {
          // Found a .gguf file - entry already has all the parsed info including size
          results.push(entry);
        }
      }
      
      return results;
    } catch (error) {
      throw new Error(`Error finding GGUF files: ${error.message}`);
    }
  }

  /**
   * Parses directory/file entries from a Hugging Face tree view page
   * @param {string} html - The HTML content
   * @param {string} currentPath - Current path for context
   * @returns {Array} - Array of entry objects with complete information
   */
  static parseTreeEntries(html, currentPath = '') {
    const entries = [];
    
    // First, try to extract the JSON data that Hugging Face embeds in the page
    // This is more reliable than parsing the HTML
    const jsonDataRegex = /<script[^>]*id="__NEXT_DATA__"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/;
    const jsonMatch = html.match(jsonDataRegex);
    
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        // Try to extract file information from the JSON structure
        // This is a simplified approach - actual structure may vary
        const entriesFromJson = this.extractEntriesFromJson(jsonData, currentPath);
        if (entriesFromJson.length > 0) {
          return entriesFromJson;
        }
      } catch (e) {
        // Fall back to HTML parsing if JSON parsing fails
      }
    }
    
    // Fallback: Parse HTML directly
    // Find all list items in the tree view
    const liRegex = /<li[^>]*class="[^"]*grid[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
    let liMatch;
    
    while ((liMatch = liRegex.exec(html)) !== null) {
      const liContent = liMatch[1];
      
      try {
        // Check if it's a directory (has folder icon)
        const isDirectory = liContent.includes('viewBox="0 0 24 24"') && 
                           liContent.includes('fill="currentColor"') &&
                           liContent.includes('d="M10 4H4');
        
        // Check if it's a file (has file icon)
        const isFile = liContent.includes('viewBox="0 0 32 32"') && 
                      liContent.includes('d="M25.7 9.3l-7-7A');
        
        if (!isDirectory && !isFile) continue;
        
        // Extract name
        const nameRegex = /<span[^>]*class="[^"]*truncate[^"]*"[^>]*>([^<]+)<\/span>/;
        const nameMatch = liContent.match(nameRegex);
        const name = nameMatch ? nameMatch[1].trim() : '';
        
        if (!name) continue;
        
        // Extract size for files
        let size = 0;
        let sizeFormatted = '';
        
        if (isFile) {
          // Look for size in the file entry - multiple possible patterns
          const sizePatterns = [
            /<span[^>]*class="[^"]*font-mono[^"]*"[^>]*>([^<]+)<\/span>/,
            /<span[^>]*class="[^"]*text-sm[^"]*text-gray-400[^"]*"[^>]*>([^<]+)<\/span>/,
            /<span[^>]*class="[^"]*text-xs[^"]*text-gray-400[^"]*"[^>]*>([^<]+)<\/span>/,
            />\s*(\d+(?:\.\d+)?\s*(?:[kKMGT]?B?))\s*</
          ];
          
          for (const pattern of sizePatterns) {
            const sizeMatch = liContent.match(pattern);
            if (sizeMatch) {
              sizeFormatted = sizeMatch[1].trim();
              size = this.parseFileSize(sizeFormatted);
              break;
            }
          }
        }
        
        // Extract download link if present
        let downloadUrl = null;
        const downloadRegex = /<a[^>]*href="([^"]*)"[^>]*title="Download file"[^>]*>/;
        const downloadMatch = liContent.match(downloadRegex);
        if (downloadMatch) {
          const downloadPath = downloadMatch[1];
          downloadUrl = downloadPath.startsWith('http') 
            ? downloadPath 
            : `https://huggingface.co${downloadPath}`;
        }
        
        // Extract last commit message
        const commitRegex = /<a[^>]*href="[^"]*\/commit\/[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*truncate[^"]*"[^>]*>([^<]+)<\/span>/;
        const commitMatch = liContent.match(commitRegex);
        const lastCommit = commitMatch ? commitMatch[1].trim() : '';
        
        // Construct paths
        const filePath = currentPath ? `${currentPath}/${name}` : name;
        const baseUrl = html.match(/<meta[^>]*property="og:url"[^>]*content="([^"]+)"/)?.[1] || '';
        const baseModelUrl = baseUrl.replace(/\/tree\/main.*$/, '').replace(/\/blob\/main.*$/, '');
        
        entries.push({
          type: isDirectory ? 'directory' : 'file',
          name,
          path: filePath,
          size,
          sizeFormatted: sizeFormatted || this.formatBytes(size),
          downloadUrl: downloadUrl || (isFile ? `${baseModelUrl}/resolve/main/${filePath}` : null),
          pageUrl: isFile ? `${baseModelUrl}/blob/main/${filePath}` : null,
          lastCommit
        });
        
      } catch (err) {
        // Skip problematic entries
      }
    }
    
    return entries;
  }

  /**
   * Attempts to extract file entries from Next.js JSON data
   * @param {Object} jsonData - Parsed JSON from __NEXT_DATA__
   * @param {string} currentPath - Current path
   * @returns {Array} - Array of entries
   */
  static extractEntriesFromJson(jsonData, currentPath) {
    const entries = [];
    
    try {
      // This is a best-effort attempt to find file info in the JSON
      // The structure may vary, so we search recursively
      const findFiles = (obj, path = '') => {
        if (!obj || typeof obj !== 'object') return;
        
        if (Array.isArray(obj)) {
          obj.forEach(item => findFiles(item, path));
          return;
        }
        
        // Check if this object looks like a file entry
        if (obj.name && (obj.type === 'file' || obj.type === 'directory')) {
          const isDirectory = obj.type === 'directory';
          const isFile = obj.type === 'file';
          
          if (isFile && obj.name.toLowerCase().endsWith('.gguf')) {
            entries.push({
              type: 'file',
              name: obj.name,
              path: currentPath ? `${currentPath}/${obj.name}` : obj.name,
              size: obj.size || 0,
              sizeFormatted: obj.size ? this.formatBytes(obj.size) : 'Unknown',
              downloadUrl: obj.downloadUrl || null,
              pageUrl: obj.url || null,
              lastCommit: obj.lastCommit || ''
            });
          } else if (isDirectory) {
            entries.push({
              type: 'directory',
              name: obj.name,
              path: currentPath ? `${currentPath}/${obj.name}` : obj.name
            });
          }
        }
        
        // Recursively search all properties
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            findFiles(obj[key], path);
          }
        }
      };
      
      findFiles(jsonData, currentPath);
    } catch (e) {
      // Silently fail and fall back to HTML parsing
    }
    
    return entries;
  }

  /**
   * Parses human-readable file sizes
   * @param {string} sizeStr - The size string (e.g., "55.8 GB", "11.4 kB")
   * @returns {number} - Size in bytes
   */
  static parseFileSize(sizeStr) {
    if (!sizeStr) return 0;
    
    // Clean the string
    const cleanStr = sizeStr.trim().replace(/\s+/g, ' ');
    
    // Match pattern like "55.8 GB" or "11.4 kB" or "492 MB"
    const match = cleanStr.match(/^([\d.]+)\s*([kKMGT]?B?)$/i);
    if (!match) return 0;
    
    const num = parseFloat(match[1]);
    let unit = match[2].toUpperCase().replace('B', '');
    
    // Handle cases where unit might be just 'B' or empty
    if (unit === '') unit = 'B';
    
    const multipliers = {
      'B': 1,
      'K': 1024,
      'M': 1024 * 1024,
      'G': 1024 * 1024 * 1024,
      'T': 1024 * 1024 * 1024 * 1024
    };
    
    return Math.round(num * (multipliers[unit] || 1));
  }

  /**
   * Formats bytes to human-readable size
   * @param {number} bytes - Size in bytes
   * @returns {string} - Formatted size
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    if (!bytes) return 'Unknown';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ============================================
  // PART 3: ROBUST DOWNLOAD METHOD
  // ============================================

  /**
   * Downloads a file from a URL with progress tracking and cancellation support
   * @param {string} fileUrl - The URL of the file to download
   * @param {Object} options - Download options
   * @param {string} options.filename - Custom filename (optional, defaults from URL)
   * @param {string} options.downloadDir - Download directory (default: './models')
   * @param {boolean} options.showProgress - Show progress bar (default: true)
   * @param {boolean} options.resume - Resume partial download (default: false)
   * @param {number} options.timeout - Timeout in ms (default: 30000)
   * @param {number} options.retries - Number of retries on failure (default: 3)
   * @param {Function} options.onProgress - Progress callback (received, total, percent)
   * @param {Function} options.onCancel - Callback when download is cancelled
   * @returns {Promise<Object>} - Download result { filePath, size, duration }
   */
  static async downloadFile(fileUrl, options = {}) {
    const {
      filename = null,
      downloadDir = path.join(process.cwd(), 'models'),
      showProgress = true,
      resume = false,
      timeout = 30000,
      retries = 3,
      onProgress = null,
      onCancel = null
    } = options;

    // Create download ID for cancellation
    const downloadId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    // Ensure download directory exists
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
      console.log(`📁 Created directory: ${downloadDir}`);
    }

    // Parse URL and determine filename
    const parsedUrl = new URL(fileUrl);
    const urlFilename = path.basename(parsedUrl.pathname);
    const finalFilename = filename || urlFilename || 'download.bin';
    const filePath = path.join(downloadDir, finalFilename);

    // Check if file already exists
    if (fs.existsSync(filePath) && !resume) {
      const stats = fs.statSync(filePath);
      console.log(`⚠️ File already exists: ${finalFilename} (${this.formatBytes(stats.size)})`);
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('❓ Overwrite? (y/n): ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'y') {
        return { 
          filePath, 
          skipped: true, 
          size: stats.size,
          message: 'Download skipped - file exists'
        };
      }
    }

    // Determine start byte for resume
    let startByte = 0;
    if (resume && fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      startByte = stats.size;
      console.log(`🔄 Resuming download from byte ${startByte} (${this.formatBytes(startByte)})`);
    }

    return new Promise((resolve, reject) => {
      let downloadedBytes = startByte;
      let totalBytes = 0;
      let startTime = Date.now();
      let lastProgressTime = Date.now();
      let lastDownloadedBytes = startByte;
      let cancelled = false;
      let response;

      // Setup cancellation
      const cancelToken = { cancelled: false };
      HF.activeDownloads.set(downloadId, {
        cancel: () => {
          cancelled = true;
          cancelToken.cancelled = true;
          if (req) req.destroy();
          if (onCancel) onCancel();
        }
      });

      // Configure request with range header for resume
      const headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; HF-Downloader/1.0)'
      };
      
      if (startByte > 0) {
        headers['Range'] = `bytes=${startByte}-`;
      }

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers,
        timeout
      };

      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      const req = protocol.get(options, (res) => {
        response = res;
        
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            console.log(`🔄 Redirecting to: ${redirectUrl}`);
            HF.activeDownloads.delete(downloadId);
            // Resolve with recursive call
            HF.downloadFile(redirectUrl, options).then(resolve).catch(reject);
            return;
          }
        }

        // Check for valid response
        if (res.statusCode === 416) {
          // Range not satisfiable - file might be complete
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            console.log(`✅ File already complete: ${this.formatBytes(stats.size)}`);
            HF.activeDownloads.delete(downloadId);
            resolve({ 
              filePath, 
              size: stats.size, 
              duration: 0,
              resumed: true,
              complete: true 
            });
            return;
          }
        }

        if (res.statusCode !== 200 && res.statusCode !== 206) {
          HF.activeDownloads.delete(downloadId);
          reject(new Error(`HTTP error: ${res.statusCode} ${res.statusMessage}`));
          return;
        }

        // Get total file size from content-range or content-length
        const contentRange = res.headers['content-range'];
        if (contentRange) {
          const match = contentRange.match(/bytes \d+-(\d+)\/(\d+)/);
          if (match) {
            totalBytes = parseInt(match[2], 10);
          }
        } else {
          totalBytes = parseInt(res.headers['content-length'] || '0', 10) + startByte;
        }

        // Open file stream (append if resuming)
        const fileStream = fs.createWriteStream(filePath, { 
          flags: startByte > 0 ? 'a' : 'w' 
        });

        // Pipe response to file
        res.pipe(fileStream);

        // Track progress
        res.on('data', (chunk) => {
          if (cancelToken.cancelled) return;
          
          downloadedBytes += chunk.length;
          
          // Throttle progress updates to avoid console spam
          const now = Date.now();
          if (showProgress && (now - lastProgressTime > 100 || downloadedBytes === totalBytes)) {
            const percent = totalBytes ? ((downloadedBytes / totalBytes) * 100).toFixed(1) : '?';
            const speed = (downloadedBytes - lastDownloadedBytes) / ((now - lastProgressTime) / 1000) || 0;
            const elapsed = (now - startTime) / 1000;
            const eta = totalBytes && speed > 0 
              ? ((totalBytes - downloadedBytes) / speed).toFixed(0) 
              : '?';
            
            // Clear line and show progress
            process.stdout.write('\r\x1b[K');
            process.stdout.write(
              `📥 Downloading: ${finalFilename} - ` +
              `${this.formatBytes(downloadedBytes)}/${totalBytes ? this.formatBytes(totalBytes) : '?'} ` +
              `(${percent}%) ` +
              `[${this.formatSpeed(speed)}] ` +
              `ETA: ${eta}s`
            );
            
            if (onProgress) {
              onProgress(downloadedBytes, totalBytes, parseFloat(percent));
            }
            
            lastProgressTime = now;
            lastDownloadedBytes = downloadedBytes;
          }
        });

        // Handle completion
        fileStream.on('finish', () => {
          if (cancelled) {
            HF.activeDownloads.delete(downloadId);
            reject(new Error('Download cancelled'));
            return;
          }

          const duration = (Date.now() - startTime) / 1000;
          
          if (showProgress) {
            process.stdout.write('\n');
            console.log(`✅ Download complete: ${finalFilename}`);
            console.log(`   📦 Size: ${this.formatBytes(downloadedBytes)}`);
            console.log(`   ⏱️  Time: ${duration.toFixed(1)}s`);
            console.log(`   📁 Path: ${filePath}`);
          }

          HF.activeDownloads.delete(downloadId);
          resolve({
            filePath,
            size: downloadedBytes,
            duration,
            resumed: startByte > 0
          });
        });

        // Handle errors
        fileStream.on('error', (err) => {
          HF.activeDownloads.delete(downloadId);
          reject(new Error(`File write error: ${err.message}`));
        });

        res.on('error', (err) => {
          HF.activeDownloads.delete(downloadId);
          reject(new Error(`Response error: ${err.message}`));
        });
      });

      req.on('timeout', () => {
        req.destroy();
        HF.activeDownloads.delete(downloadId);
        reject(new Error('Request timeout'));
      });

      req.on('error', (err) => {
        HF.activeDownloads.delete(downloadId);
        reject(new Error(`Request error: ${err.message}`));
      });

      // Store request for potential cancellation
      this.activeDownloads.get(downloadId).req = req;
    }).catch(async (error) => {
      HF.activeDownloads.delete(downloadId);
      
      // Retry logic
      if (retries > 0) {
        console.log(`\n⚠️ Download failed: ${error.message}. Retrying... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.downloadFile(fileUrl, { ...options, retries: retries - 1 });
      }
      
      throw error;
    });
  }

  /**
   * Downloads multiple files with concurrency control
   * @param {Array<string|Object>} files - Array of file URLs or { url, filename } objects
   * @param {Object} options - Download options
   * @param {number} options.concurrency - Number of parallel downloads (default: 3)
   * @param {string} options.downloadDir - Download directory (default: './models')
   * @param {boolean} options.showProgress - Show overall progress (default: true)
   * @returns {Promise<Array>} - Array of download results
   */
  static async downloadMultiple(files, options = {}) {
    const {
      concurrency = 3,
      downloadDir = path.join(process.cwd(), 'models'),
      showProgress = true,
      ...downloadOptions
    } = options;

    const results = [];
    const queue = [...files];
    const active = new Set();
    let completed = 0;

    console.log(`📥 Downloading ${files.length} files (max ${concurrency} concurrent)`);

    return new Promise((resolve, reject) => {
      const next = async () => {
        if (queue.length === 0 && active.size === 0) {
          if (showProgress) console.log('\n✅ All downloads completed');
          resolve(results);
          return;
        }

        while (queue.length > 0 && active.size < concurrency) {
          const file = queue.shift();
          const fileUrl = typeof file === 'string' ? file : file.url;
          const filename = typeof file === 'object' ? file.filename : null;
          
          const promise = (async () => {
            try {
              const result = await this.downloadFile(fileUrl, {
                ...downloadOptions,
                filename,
                downloadDir,
                showProgress: false // Don't show individual progress bars
              });
              
              results.push({ ...result, url: fileUrl });
              completed++;
              
              if (showProgress) {
                console.log(`✅ [${completed}/${files.length}] ${path.basename(result.filePath)}`);
              }
              
            } catch (error) {
              results.push({ url: fileUrl, error: error.message, failed: true });
              console.error(`❌ Failed: ${fileUrl} - ${error.message}`);
            } finally {
              active.delete(promise);
              next();
            }
          })();
          
          active.add(promise);
        }
      };

      next();
    });
  }

  /**
   * Cancels an active download
   * @param {string} downloadId - The download ID to cancel
   * @returns {boolean} - Whether cancellation was successful
   */
  static cancelDownload(downloadId) {
    const download = this.activeDownloads.get(downloadId);
    if (download) {
      download.cancel();
      return true;
    }
    return false;
  }

  /**
   * Gets list of active downloads
   * @returns {Array} - Array of active download IDs
   */
  static getActiveDownloads() {
    return Array.from(this.activeDownloads.keys());
  }

  /**
   * Formats speed in bytes per second
   * @param {number} bytesPerSecond - Speed in bytes/sec
   * @returns {string} - Formatted speed
   */
  static formatSpeed(bytesPerSecond) {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  }

  // ============================================
  // PART 4: SECOND PLAN DOWNLOAD (Background/Quiet Mode)
  // ============================================

  /**
   * Downloads a file in the background with minimal output
   * Perfect for automated scripts or when you want to track progress separately
   * @param {string} fileUrl - The URL of the file to download
   * @param {Object} options - Download options
   * @param {string} options.filename - Custom filename
   * @param {string} options.downloadDir - Download directory
   * @param {Function} options.onProgress - Progress callback (received, total, percent, speed)
   * @param {Function} options.onComplete - Completion callback (result)
   * @param {Function} options.onError - Error callback (error)
   * @returns {Promise<Object>} - Download result (same as downloadFile)
   */
  static async downloadFileBackground(fileUrl, options = {}) {
    const {
      onProgress = null,
      onComplete = null,
      onError = null,
      ...restOptions
    } = options;

    // Create a more detailed progress handler for background mode
    const progressHandler = (received, total, percent) => {
      if (onProgress) {
        const speed = this.calculateCurrentSpeed(received);
        onProgress({
          received,
          total,
          percent,
          speed,
          speedFormatted: this.formatSpeed(speed),
          receivedFormatted: this.formatBytes(received),
          totalFormatted: this.formatBytes(total),
          eta: total ? this.calculateETA(received, total, speed) : null
        });
      }
    };

    try {
      const result = await this.downloadFile(fileUrl, {
        ...restOptions,
        showProgress: false, // Disable console output
        onProgress: progressHandler
      });

      if (onComplete) onComplete(result);
      return result;

    } catch (error) {
      if (onError) onError(error);
      throw error;
    }
  }

  /**
   * Creates a download job that can be monitored
   * @param {string} fileUrl - The URL to download
   * @param {Object} options - Download options
   * @returns {Object} - Download job with promise and monitoring methods
   */
  static createDownloadJob(fileUrl, options = {}) {
    let progressCallback = null;
    let completeCallback = null;
    let errorCallback = null;
    let jobPromise = null;
    let isCancelled = false;

    const job = {
      onProgress: (callback) => {
        progressCallback = callback;
        return job;
      },
      onComplete: (callback) => {
        completeCallback = callback;
        return job;
      },
      onError: (callback) => {
        errorCallback = callback;
        return job;
      },
      cancel: () => {
        isCancelled = true;
        if (jobPromise && jobPromise.downloadId) {
          HF.cancelDownload(jobPromise.downloadId);
        }
      },
      start: async () => {
        if (isCancelled) {
          throw new Error('Download cancelled before start');
        }

        const jobOptions = {
          ...options,
          onProgress: (received, total, percent) => {
            if (progressCallback && !isCancelled) {
              const speed = HF.calculateCurrentSpeed(received);
              progressCallback({
                received,
                total,
                percent,
                speed,
                speedFormatted: HF.formatSpeed(speed),
                receivedFormatted: HF.formatBytes(received),
                totalFormatted: HF.formatBytes(total),
                eta: total ? HF.calculateETA(received, total, speed) : null
              });
            }
          }
        };

        jobPromise = HF.downloadFileBackground(fileUrl, jobOptions);
        
        // Store downloadId for cancellation
        jobPromise.downloadId = Date.now().toString(36);
        
        const result = await jobPromise;
        if (!isCancelled && completeCallback) {
          completeCallback(result);
        }
        return result;
      }
    };

    return job;
  }

  /**
   * Calculates current download speed
   * @param {number} received - Bytes received so far
   * @returns {number} - Speed in bytes/sec
   */
  static calculateCurrentSpeed(received) {
    if (!this._lastSpeedCheck) {
      this._lastSpeedCheck = { received, time: Date.now() };
      return 0;
    }

    const now = Date.now();
    const timeDiff = (now - this._lastSpeedCheck.time) / 1000;
    if (timeDiff < 0.1) return this._lastSpeed;

    const bytesDiff = received - this._lastSpeedCheck.received;
    const speed = bytesDiff / timeDiff;
    
    this._lastSpeedCheck = { received, time: now };
    this._lastSpeed = speed;
    
    return speed;
  }

  /**
   * Calculates ETA based on progress
   * @param {number} received - Bytes received
   * @param {number} total - Total bytes
   * @param {number} speed - Current speed in bytes/sec
   * @returns {number} - ETA in seconds
   */
  static calculateETA(received, total, speed) {
    if (!speed || speed <= 0) return null;
    const remaining = total - received;
    return remaining / speed;
  }

  // ============================================
  // PART 5: UTILITY METHODS
  // ============================================

  /**
   * Filters models by various criteria
   * @param {Array} models - Array of model objects
   * @param {Object} filters - Filter criteria
   * @returns {Array} - Filtered models
   */
  static filterModels(models, filters = {}) {
    return models.filter(model => {
      if (filters.author && !model.author?.includes(filters.author)) return false;
      if (filters.minDownloads && (model.downloads || 0) < filters.minDownloads) return false;
      if (filters.minLikes && (model.likes || 0) < filters.minLikes) return false;
      if (filters.hasInference !== undefined && model.hasInference !== filters.hasInference) return false;
      if (filters.task && model.task !== filters.task) return false;
      if (filters.isGGUF !== undefined && model.isGGUF !== filters.isGGUF) return false;
      return true;
    });
  }

  /**
   * Sorts models by a specific field
   * @param {Array} models - Array of model objects
   * @param {string} sortBy - Field to sort by
   * @param {string} order - 'asc' or 'desc'
   * @returns {Array} - Sorted models
   */
  static sortModels(models, sortBy = 'downloads', order = 'desc') {
    return [...models].sort((a, b) => {
      let aVal = a[sortBy] || 0;
      let bVal = b[sortBy] || 0;
      
      if (sortBy === 'lastUpdated') {
        aVal = new Date(aVal).getTime() || 0;
        bVal = new Date(bVal).getTime() || 0;
      }
      
      if (sortBy === 'fullName' || sortBy === 'author' || sortBy === 'modelName') {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
        return order === 'desc' 
          ? bVal.localeCompare(aVal) 
          : aVal.localeCompare(bVal);
      }
      
      return order === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }

  /**
   * Clears the page cache
   */
  static clearCache() {
    this.pageCache.clear();
    console.log('🧹 Cache cleared');
  }

  /**
   * Gets cache statistics
   * @returns {Object} - Cache stats
   */
  static getCacheStats() {
    return {
      size: this.pageCache.size,
      keys: Array.from(this.pageCache.keys()),
      entries: Array.from(this.pageCache.entries()).map(([key, value]) => ({
        key,
        age: Date.now() - value.timestamp,
        ageFormatted: this.formatTime(Date.now() - value.timestamp)
      }))
    };
  }

  /**
   * Formats milliseconds to human-readable time
   * @param {number} ms - Milliseconds
   * @returns {string} - Formatted time
   */
  static formatTime(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }
}

// ============================================
// EXAMPLE USAGE (auto-runs when file is executed directly)
// ============================================

async function example() {
  console.log('🔍 HUGGING FACE API - STATIC CLASS EXAMPLE');
  console.log('=' .repeat(70));
  
  // Example 1: Fetch models
  console.log('\n📋 EXAMPLE 1: Fetching GGUF models');
  console.log('=' .repeat(70));
  
  try {
    const result = await HF.fetchModelsPage({ search: 'gguf', sortBy: 'downloads' });
    console.log(`✅ Found ${result.models.length} models on page ${result.pagination.currentPage}`);
    
    if (result.models.length > 0) {
      const firstModel = result.models[0];
      console.log(`\n📊 Top model: ${firstModel.fullName}`);
      console.log(`   ⬇️ Downloads: ${firstModel.downloads.toLocaleString()}`);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  // Example 2: Find GGUF files
  console.log('\n\n📋 EXAMPLE 2: Finding GGUF files');
  console.log('=' .repeat(70));
  
  try {
    // Use a known GGUF model for demo
    const testUrl = 'https://huggingface.co/hugging-quants/Llama-3.2-1B-Instruct-Q8_0-GGUF';
    console.log(`🔍 Testing: ${testUrl}`);
    
    const files = await HF.findGGUFFiles(testUrl);
    console.log(`✅ Found ${files.length} GGUF files`);
    
    if (files.length > 0) {
      const firstFile = files[0];
      console.log(`\n📊 First file: ${firstFile.name}`);
      console.log(`   📦 Size: ${firstFile.sizeFormatted}`);
      console.log(`   ⬇️ Download URL: ${firstFile.downloadUrl}`);
      
      // Example 3: Download a file (commented out by default - uncomment to test)
      /*
      console.log('\n\n📋 EXAMPLE 3: Downloading file');
      console.log('=' .repeat(70));
      
      const downloadResult = await HF.downloadFile(firstFile.downloadUrl, {
        filename: firstFile.name,
        showProgress: true
      });
      console.log('✅ Download result:', downloadResult);
      */
      
      // Example 4: Background download with job monitoring
      console.log('\n\n📋 EXAMPLE 4: Background download job');
      console.log('=' .repeat(70));
      
      const job = HF.createDownloadJob(firstFile.downloadUrl, {
        filename: `bg_${firstFile.name}`
      });
      
      job.onProgress((progress) => {
        console.log(`   Progress: ${progress.percent}% @ ${progress.speedFormatted}`);
      }).onComplete((result) => {
        console.log(`   ✅ Complete: ${result.filePath}`);
      }).onError((error) => {
        console.log(`   ❌ Error: ${error.message}`);
      });
      
      // Uncomment to start the download
      // await job.start();
      console.log('   (Job created but not started - uncomment to test)');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n✅ Done!');
  console.log('=' .repeat(70));
}

// Run the example if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  //example();
}