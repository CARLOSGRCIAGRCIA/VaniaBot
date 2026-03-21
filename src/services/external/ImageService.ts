import axios from 'axios';
import { logError } from '@/utils/logger.js';

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  photographer: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
  };
  alt: string;
}

interface ImageResult {
  id: number;
  url: string;
  photographer: string;
  alt: string;
  width: number;
  height: number;
}

export class ImageService {
  private static instance: ImageService;
  private readonly PEXELS_API = 'https://api.pexels.com/v1/search';
  private readonly API_KEY = process.env.PEXELS_API_KEY;
  private cache = new Map<string, ImageResult[]>();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  static getInstance(): ImageService {
    if (!ImageService.instance) {
      ImageService.instance = new ImageService();
    }
    return ImageService.instance;
  }

  async searchImages(query: string, perPage: number = 5): Promise<ImageResult[]> {
    if (!this.API_KEY) {
      return this.getMockImages(query);
    }

    const cacheKey = `${query}:${perPage}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await axios.get(this.PEXELS_API, {
        headers: { Authorization: this.API_KEY },
        params: { query, per_page: perPage, orientation: 'square' },
        timeout: 8000,
      });

      const photos: ImageResult[] = (response.data.photos ?? []).map((photo: PexelsPhoto) => ({
        id: photo.id,
        url: photo.src.large,
        photographer: photo.photographer,
        alt: photo.alt,
        width: photo.width,
        height: photo.height,
      }));

      this.cache.set(cacheKey, photos);
      return photos;
    } catch (error) {
      logError('ImageService.searchImages', error);
      return this.getMockImages(query);
    }
  }

  private getMockImages(query: string): ImageResult[] {
    return [
      {
        id: 1,
        url: `https://source.unsplash.com/800x800/?${encodeURIComponent(query)}`,
        photographer: 'Unsplash',
        alt: query,
        width: 800,
        height: 800,
      },
    ];
  }
}

export const imageService = ImageService.getInstance();
