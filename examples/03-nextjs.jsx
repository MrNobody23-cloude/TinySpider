/**
 * Insight Analytics Next.js Integration Example
 * 
 * Integration pattern for Next.js applications with App Router
 */

// hooks/useInsight.js
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useInsight() {
  const router = useRouter();

  useEffect(() => {
    // Configure Insight Analytics
    window.InsightConfig = {
      siteId: 'my-nextjs-app',
      endpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT || 'http://localhost:3000/collect',
      debug: process.env.NODE_ENV === 'development'
    };

    // Load tracker script
    const script = document.createElement('script');
    script.src = `${window.InsightConfig.endpoint.replace('/collect', '')}/tracker.js`;
    script.async = true;
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Track route changes
  useEffect(() => {
    if (window.Insight && window.Insight.track) {
      window.Insight.track({
        event_type: 'route-change',
        event_value: router.pathname || window.location.pathname
      });
    }
  }, [router.pathname]);

  return {
    track: (eventType, eventValue, metadata = {}) => {
      if (window.Insight && window.Insight.track) {
        window.Insight.track({
          event_type: eventType,
          event_value: eventValue,
          metadata: {
            timestamp: new Date().toISOString(),
            ...metadata
          }
        });
      }
    }
  };
}

// lib/analytics.js
export const trackEvent = (eventType, eventValue, metadata = {}) => {
  if (typeof window === 'undefined') return;

  if (window.Insight && window.Insight.track) {
    window.Insight.track({
      event_type: eventType,
      event_value: eventValue,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    });
  }
};

// app/layout.jsx
'use client';

import { useInsight } from '@/hooks/useInsight';

export default function RootLayout({ children }) {
  useInsight();

  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}

// app/page.jsx - Example: Track e-commerce events
'use client';

import { useInsight } from '@/hooks/useInsight';
import { trackEvent } from '@/lib/analytics';

export default function Home() {
  const { track } = useInsight();

  const handleProductView = (productId, productName) => {
    track('product-view', productId, {
      productName,
      category: 'electronics',
      source: 'homepage'
    });
  };

  const handleAddToCart = (productId) => {
    track('add-to-cart', productId, {
      quantity: 1,
      price: 299.99
    });
  };

  const handleSignup = () => {
    trackEvent('user-signup', 'free-trial', {
      signupMethod: 'email'
    });
  };

  return (
    <main>
      <h1>Welcome to Next.js + Insight Analytics</h1>

      <section className="products">
        <div
          className="product-card"
          onClick={() => handleProductView('prod-1', 'Laptop')}
        >
          <h2>Laptop - $999</h2>
          <p>High-performance laptop for professionals</p>
          <button onClick={() => handleAddToCart('prod-1')}>
            Add to Cart
          </button>
        </div>

        <div
          className="product-card"
          onClick={() => handleProductView('prod-2', 'Mouse')}
        >
          <h2>Wireless Mouse - $49</h2>
          <p>Ergonomic wireless mouse</p>
          <button onClick={() => handleAddToCart('prod-2')}>
            Add to Cart
          </button>
        </div>
      </section>

      <button onClick={handleSignup}>Sign Up Free</button>
    </main>
  );
}

// app/products/[id]/page.jsx - Product detail page
'use client';

import { useInsight } from '@/hooks/useInsight';
import { useSearchParams } from 'next/navigation';

export default function ProductDetail({ params }) {
  const { track } = useInsight();
  const searchParams = useSearchParams();

  // Track product view with details
  React.useEffect(() => {
    track('product-detail-view', params.id, {
      category: searchParams.get('category'),
      utm_source: searchParams.get('utm_source'),
      utm_campaign: searchParams.get('utm_campaign')
    });
  }, [params.id]);

  const handleAddToCart = () => {
    track('add-to-cart', params.id, {
      location: 'product-detail',
      quantity: 1
    });
  };

  const handleShare = (platform) => {
    track('share', platform, {
      productId: params.id,
      contentType: 'product'
    });
  };

  return (
    <div>
      <h1>Product {params.id}</h1>
      <button onClick={handleAddToCart}>Add to Cart</button>

      <div className="share">
        <button onClick={() => handleShare('facebook')}>
          Share on Facebook
        </button>
        <button onClick={() => handleShare('twitter')}>
          Share on Twitter
        </button>
      </div>
    </div>
  );
}

// .env.local
NEXT_PUBLIC_ANALYTICS_ENDPOINT = "http://localhost:3000/collect"
NEXT_PUBLIC_ANALYTICS_SITE_ID = my - nextjs - app

// middleware.js - Track page views at middleware level
import { NextResponse } from 'next/server';

export function middleware(request) {
  // You could add custom tracking here if needed
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

/**
 * Usage in Components:
 * 
 * import { useInsight } from '@/hooks/useInsight';
 * 
 * export default function MyComponent() {
 *   const { track } = useInsight();
 *   
 *   const handleClick = () => {
 *     track('button-click', 'my-button', {
 *       section: 'header',
 *       user_type: 'premium'
 *     });
 *   };
 *   
 *   return <button onClick={handleClick}>Click me</button>;
 * }
 */
