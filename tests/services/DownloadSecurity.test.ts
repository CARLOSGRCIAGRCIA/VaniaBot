import { describe, it, expect } from 'vitest';

describe('URL Validation Security', () => {
  const BLOCKED_URL_PATTERNS = [
    /[;&|`$<>{}]/,
    /localhost/i,
    /127\.\d+\.\d+\.\d+/,
    /10\.\d+\.\d+\.\d+/,
    /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
    /192\.168\.\d+\.\d+/,
    /0\.0\.0\.0/,
    /::1/,
    /fc00:/i,
    /fe80:/i,
  ];

  function validateUrl(url: string): { valid: boolean; error?: string } {
    if (!url || url.trim().length === 0) {
      return { valid: false, error: 'URL is empty' };
    }
    if (url.length > 2048) {
      return { valid: false, error: 'URL too long' };
    }
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, error: 'Only HTTP/HTTPS URLs allowed' };
      }
      for (const pattern of BLOCKED_URL_PATTERNS) {
        if (pattern.test(url)) {
          return { valid: false, error: 'URL contains blocked patterns' };
        }
      }
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return { valid: false, error: 'Localhost URLs not allowed' };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  describe('Valid URLs', () => {
    it('should accept valid YouTube URL', () => {
      const result = validateUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result.valid).toBe(true);
    });

    it('should accept valid TikTok URL', () => {
      const result = validateUrl('https://www.tiktok.com/@user/video/1234567890');
      expect(result.valid).toBe(true);
    });

    it('should accept valid Instagram URL', () => {
      const result = validateUrl('https://www.instagram.com/reel/ABC123/');
      expect(result.valid).toBe(true);
    });

    it('should accept valid Facebook URL', () => {
      const result = validateUrl('https://www.facebook.com/watch?v=123456789');
      expect(result.valid).toBe(true);
    });
  });

  describe('SSRF Protection', () => {
    it('should block localhost URLs', () => {
      expect(validateUrl('http://localhost/path').valid).toBe(false);
      expect(validateUrl('http://localhost:3000/path').valid).toBe(false);
    });

    it('should block loopback addresses', () => {
      expect(validateUrl('http://127.0.0.1/path').valid).toBe(false);
      expect(validateUrl('http://127.0.0.1:8080/path').valid).toBe(false);
    });

    it('should block private network Class A', () => {
      expect(validateUrl('http://10.0.0.1/path').valid).toBe(false);
      expect(validateUrl('http://10.255.255.255/path').valid).toBe(false);
    });

    it('should block private network Class B', () => {
      expect(validateUrl('http://172.16.0.1/path').valid).toBe(false);
      expect(validateUrl('http://172.31.255.255/path').valid).toBe(false);
    });

    it('should block private network Class C', () => {
      expect(validateUrl('http://192.168.0.1/path').valid).toBe(false);
      expect(validateUrl('http://192.168.1.100/path').valid).toBe(false);
    });

    it('should block IPv6 loopback', () => {
      expect(validateUrl('http://[::1]/path').valid).toBe(false);
    });

    it('should block zero address', () => {
      expect(validateUrl('http://0.0.0.0/path').valid).toBe(false);
    });
  });

  describe('Command Injection Protection', () => {
    it('should block URLs with shell metacharacters', () => {
      expect(validateUrl('https://evil.com;cat /etc/passwd').valid).toBe(false);
      expect(validateUrl('https://evil.com|whoami').valid).toBe(false);
      expect(validateUrl('https://evil.com`id`').valid).toBe(false);
      expect(validateUrl('https://evil.com$(id)').valid).toBe(false);
      expect(validateUrl('https://evil.com<file').valid).toBe(false);
      expect(validateUrl('https://evil.com>file').valid).toBe(false);
    });

    it('should block non-HTTP protocols', () => {
      expect(validateUrl('ftp://example.com/file').valid).toBe(false);
      expect(validateUrl('file:///etc/passwd').valid).toBe(false);
      expect(validateUrl('javascript:alert(1)').valid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should reject empty URL', () => {
      expect(validateUrl('').valid).toBe(false);
      expect(validateUrl('   ').valid).toBe(false);
    });

    it('should reject very long URL', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2100);
      expect(validateUrl(longUrl).valid).toBe(false);
    });

    it('should reject invalid URL format', () => {
      expect(validateUrl('not-a-url').valid).toBe(false);
      expect(validateUrl('htp://wrong.com').valid).toBe(false);
    });
  });
});
