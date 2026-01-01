"""
Security Configuration & Middleware for ThreadSeeker
Enterprise-grade security implementation
"""

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime, timedelta
import secrets
import hashlib
import re
from typing import Optional
import time


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add comprehensive security headers to all responses."""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Prevent clickjacking attacks
        response.headers["X-Frame-Options"] = "DENY"
        
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Enable XSS protection
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer policy - only send origin on cross-origin requests
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Content Security Policy - Strict CSP
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https://api.groq.com https://generativelanguage.googleapis.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "upgrade-insecure-requests"
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
        
        # Permissions Policy - Restrict browser features
        permissions_policy = [
            "accelerometer=()",
            "camera=()",
            "geolocation=()",
            "gyroscope=()",
            "magnetometer=()",
            "microphone=(self)",  # Allow microphone for voice input
            "payment=()",
            "usb=()"
        ]
        response.headers["Permissions-Policy"] = ", ".join(permissions_policy)
        
        # Strict Transport Security - Force HTTPS (only in production)
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        
        # Remove server identification
        response.headers.pop("Server", None)
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting to prevent abuse and DDoS attacks."""
    
    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.request_counts = {}  # {ip: [(timestamp, count), ...]}
        self.cleanup_interval = 60  # Clean up old entries every 60 seconds
        self.last_cleanup = time.time()
    
    def _cleanup_old_entries(self):
        """Remove entries older than 1 minute."""
        current_time = time.time()
        if current_time - self.last_cleanup > self.cleanup_interval:
            cutoff_time = current_time - 60
            for ip in list(self.request_counts.keys()):
                self.request_counts[ip] = [
                    (ts, count) for ts, count in self.request_counts[ip]
                    if ts > cutoff_time
                ]
                if not self.request_counts[ip]:
                    del self.request_counts[ip]
            self.last_cleanup = current_time
    
    async def dispatch(self, request: Request, call_next):
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        
        # Cleanup old entries periodically
        self._cleanup_old_entries()
        
        # Initialize or get request count for this IP
        current_time = time.time()
        if client_ip not in self.request_counts:
            self.request_counts[client_ip] = []
        
        # Count requests in the last minute
        recent_requests = [
            (ts, count) for ts, count in self.request_counts[client_ip]
            if current_time - ts < 60
        ]
        total_requests = sum(count for _, count in recent_requests)
        
        # Check rate limit
        if total_requests >= self.requests_per_minute:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Too many requests. Please try again later.",
                    "retry_after": 60
                },
                headers={"Retry-After": "60"}
            )
        
        # Record this request
        self.request_counts[client_ip] = recent_requests + [(current_time, 1)]
        
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(self.requests_per_minute - total_requests - 1)
        response.headers["X-RateLimit-Reset"] = str(int(current_time + 60))
        
        return response


class InputValidationMiddleware(BaseHTTPMiddleware):
    """Validate and sanitize all input data."""
    
    # Dangerous patterns to detect
    DANGEROUS_PATTERNS = [
        r'<script[^>]*>.*?</script>',  # XSS
        r'javascript:',  # JavaScript protocol
        r'on\w+\s*=',  # Event handlers
        r'<iframe[^>]*>',  # iFrames
        r'<object[^>]*>',  # Objects
        r'<embed[^>]*>',  # Embeds
        r'\bexec\b',  # SQL exec
        r'\bDROP\s+TABLE\b',  # SQL DROP
        r'\bUNION\s+SELECT\b',  # SQL injection
        r'\.\./\.\.',  # Path traversal
        r'[;\|&]',  # Command injection
    ]
    
    async def dispatch(self, request: Request, call_next):
        # Only validate POST/PUT/PATCH requests with body
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                # Read and validate body
                body = await request.body()
                body_str = body.decode('utf-8')
                
                # Check for dangerous patterns
                for pattern in self.DANGEROUS_PATTERNS:
                    if re.search(pattern, body_str, re.IGNORECASE):
                        return JSONResponse(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            content={"detail": "Invalid input detected. Request blocked for security."}
                        )
                
                # Recreate request with validated body
                async def receive():
                    return {"type": "http.request", "body": body}
                
                request._receive = receive
                
            except Exception:
                pass  # If body parsing fails, let it through (FastAPI will handle)
        
        response = await call_next(request)
        return response


class APIKeyValidator:
    """Secure API key validation and sanitization."""
    
    @staticmethod
    def validate_groq_key(api_key: str) -> bool:
        """Validate Groq API key format."""
        if not api_key:
            return False
        
        # Groq keys should start with gsk_ and be alphanumeric
        if not api_key.startswith("gsk_"):
            return False
        
        # Check length (Groq keys are typically 40+ characters)
        if len(api_key) < 20:
            return False
        
        # Check for valid characters (alphanumeric and underscore)
        if not re.match(r'^[a-zA-Z0-9_]+$', api_key):
            return False
        
        return True
    
    @staticmethod
    def validate_gemini_key(api_key: str) -> bool:
        """Validate Gemini API key format."""
        if not api_key:
            return False
        
        # Gemini keys should be alphanumeric with dashes
        if len(api_key) < 20:
            return False
        
        if not re.match(r'^[a-zA-Z0-9_-]+$', api_key):
            return False
        
        return True
    
    @staticmethod
    def sanitize_key(api_key: str) -> str:
        """Remove any potentially dangerous characters from API key."""
        # Remove any non-alphanumeric characters except underscore and dash
        return re.sub(r'[^a-zA-Z0-9_-]', '', api_key)


class QuerySanitizer:
    """Sanitize user search queries to prevent injection attacks."""
    
    @staticmethod
    def sanitize_query(query: str, max_length: int = 1000) -> str:
        """Sanitize user query input."""
        if not query:
            return ""
        
        # Trim to max length
        query = query[:max_length]
        
        # Remove null bytes
        query = query.replace('\x00', '')
        
        # Remove excessive whitespace
        query = ' '.join(query.split())
        
        # Remove dangerous HTML/script tags
        query = re.sub(r'<[^>]+>', '', query)
        
        # Remove SQL injection attempts
        dangerous_sql = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'EXEC', 'UNION', 'SELECT', '--', ';--']
        for term in dangerous_sql:
            query = re.sub(rf'\b{term}\b', '', query, flags=re.IGNORECASE)
        
        # Remove command injection attempts
        query = re.sub(r'[;&|`$()]', '', query)
        
        return query.strip()
    
    @staticmethod
    def validate_query_length(query: str, min_length: int = 3, max_length: int = 1000) -> bool:
        """Validate query length."""
        return min_length <= len(query) <= max_length


class SecureHeaders:
    """Generate secure headers for responses."""
    
    @staticmethod
    def generate_csrf_token() -> str:
        """Generate a cryptographically secure CSRF token."""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def hash_token(token: str) -> str:
        """Hash a token using SHA-256."""
        return hashlib.sha256(token.encode()).hexdigest()


def setup_security_middleware(app):
    """Configure all security middleware for the FastAPI app."""
    
    # Add compression (before other middleware)
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    
    # Add rate limiting
    app.add_middleware(RateLimitMiddleware, requests_per_minute=60)
    
    # Add input validation
    app.add_middleware(InputValidationMiddleware)
    
    # Add security headers
    app.add_middleware(SecurityHeadersMiddleware)
    
    # Add trusted host middleware (prevents host header attacks)
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["localhost", "127.0.0.1", "*.vercel.app", "*.render.com"]
    )
    
    # In production, redirect HTTP to HTTPS
    # app.add_middleware(HTTPSRedirectMiddleware)  # Uncomment for production
    
    return app


# Export all security utilities
__all__ = [
    'SecurityHeadersMiddleware',
    'RateLimitMiddleware',
    'InputValidationMiddleware',
    'APIKeyValidator',
    'QuerySanitizer',
    'SecureHeaders',
    'setup_security_middleware'
]
