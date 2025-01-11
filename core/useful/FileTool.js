import fs from 'fs';
import path from 'path';

class FileTool {
  /**
   * Get the name of the file without the extension.
   * @param {string} filePath - The path to the file.
   * @returns {string|null} The name of the file without the extension, or null if an error occurs.
   */
  static fileName(filePath) {
    try {
      const fileName = path.basename(filePath);
      const nameWithoutExtension = path.parse(fileName).name;
      return nameWithoutExtension;
    } catch (error) {
      console.error(`Error getting file name: ${error.message}`);
      return null;
    }
  }

  /**
   * Get the size of the file in GB.
   * @param {string} filePath - The path to the file.
   * @param {object} config - Configuration object.
   * @param {boolean} config.includeUnit - Whether to include the unit (GB) in the output.
   * @returns {number|string|null} The size of the file in GB, or null if an error occurs.
   */
  static fileSize(filePath, config = { includeUnit: false }) {
    try {
      const stats = fs.statSync(filePath);
      const fileSizeInBytes = stats.size;
      const fileSizeInGB = fileSizeInBytes / (1024 ** 3);

      if (config.includeUnit) {
        return `${fileSizeInGB.toFixed(2)} GB`;
      }

      return fileSizeInGB;
    } catch (error) {
      console.error(`Error getting file size: ${error.message}`);
      return null;
    }
  }
}

export default FileTool;
