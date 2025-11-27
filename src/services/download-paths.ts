// Download Paths Manager - Gestión de rutas de descarga personalizadas

import { STORAGE_KEYS } from '@shared/constants';
import type { DownloadPath, DownloadPathsConfig } from '@shared/types';

export class DownloadPathsManager {
  private readonly STORAGE_KEY = STORAGE_KEYS.DOWNLOAD_PATHS;

  /**
   * Get current paths configuration
   */
  async getConfig(): Promise<DownloadPathsConfig> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const config = result[this.STORAGE_KEY];

      if (config && this.isValidConfig(config)) {
        return config;
      }

      // Return default config
      return this.getDefaultConfig();
    } catch (error) {
      console.error('Error loading paths config:', error);
      return this.getDefaultConfig();
    }
  }

  /**
   * Save paths configuration
   */
  async saveConfig(config: DownloadPathsConfig): Promise<void> {
    try {
      await chrome.storage.local.set({ [this.STORAGE_KEY]: config });
      console.log('✅ Paths config saved:', config);
    } catch (error) {
      console.error('❌ Error saving paths config:', error);
      throw error;
    }
  }

  /**
   * Add a new path
   */
  async addPath(path: string): Promise<DownloadPath> {
    const config = await this.getConfig();

    const newPath: DownloadPath = {
      id: this.generateId(),
      path: this.sanitizePath(path),
      isDefault: false,
      lastUsed: 0,
      createdAt: Date.now(),
    };

    config.paths.push(newPath);
    await this.saveConfig(config);

    return newPath;
  }

  /**
   * Remove a path
   */
  async removePath(id: string): Promise<void> {
    const config = await this.getConfig();

    // Don't allow removing default path
    if (id === 'default') {
      throw new Error('Cannot remove default path');
    }

    config.paths = config.paths.filter((p) => p.id !== id);

    // If active path was removed, reset to default
    if (config.activePathId === id) {
      config.activePathId = 'default';
    }

    await this.saveConfig(config);
  }

  /**
   * Set active path
   */
  async setActivePath(id: string): Promise<void> {
    const config = await this.getConfig();

    if (id !== 'default' && id !== 'ask') {
      const pathExists = config.paths.some((p) => p.id === id);
      if (!pathExists) {
        throw new Error('Path not found');
      }

      // Update lastUsed
      const path = config.paths.find((p) => p.id === id);
      if (path) {
        path.lastUsed = Date.now();
      }
    }

    config.activePathId = id;
    config.askEveryTime = id === 'ask';

    await this.saveConfig(config);
  }

  /**
   * Get current download path (null means use default Downloads folder)
   */
  async getDownloadPath(): Promise<string | null> {
    const config = await this.getConfig();

    if (config.activePathId === 'default' || config.activePathId === 'ask') {
      return null;
    }

    const activePath = config.paths.find((p) => p.id === config.activePathId);
    return activePath ? activePath.path : null;
  }

  /**
   * Check if should ask user for path every time
   */
  async shouldAskEveryTime(): Promise<boolean> {
    const config = await this.getConfig();
    return config.askEveryTime || config.activePathId === 'ask';
  }

  /**
   * Update path details
   */
  async updatePath(id: string, updates: Partial<Pick<DownloadPath, 'path'>>): Promise<void> {
    const config = await this.getConfig();
    const path = config.paths.find((p) => p.id === id);

    if (!path) {
      throw new Error('Path not found');
    }

    if (updates.path) path.path = this.sanitizePath(updates.path);

    await this.saveConfig(config);
  }

  // === Private Helper Methods ===

  private getDefaultConfig(): DownloadPathsConfig {
    return {
      paths: [],
      activePathId: 'default',
      askEveryTime: false,
    };
  }

  private generateId(): string {
    return `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizePath(path: string): string {
    // Remove leading/trailing slashes and spaces
    let sanitized = path.trim().replace(/^[/\\]+|[/\\]+$/g, '');

    // Replace backslashes with forward slashes
    sanitized = sanitized.replace(/\\/g, '/');

    // Remove invalid characters for file paths
    sanitized = sanitized.replace(/[<>:"|?*]/g, '');

    // Remove double slashes
    sanitized = sanitized.replace(/\/+/g, '/');

    return sanitized;
  }

  private isValidConfig(config: any): config is DownloadPathsConfig {
    return (
      config &&
      typeof config === 'object' &&
      Array.isArray(config.paths) &&
      typeof config.activePathId === 'string' &&
      typeof config.askEveryTime === 'boolean'
    );
  }
}
