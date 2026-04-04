import React, { useEffect } from 'react';

/**
 * Insight Analytics React Integration Example
 * 
 * This component demonstrates how to integrate Insight Analytics
 * tracking into a React application.
 */

// Initialize Insight Analytics (typically in your main.jsx or App.jsx)
export function InitializeInsight() {
  useEffect(() => {
    // Configure tracker
    window.InsightConfig = {
      siteId: 'my-react-app',
      endpoint: 'http://localhost:3000/collect',
      debug: false
    };

    // Load tracker script
    const script = document.createElement('script');
    script.src = 'http://localhost:3000/tracker.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
      document.head.removeChild(script);
    };
  }, []);

  return null;
}

/**
 * Hook: Track page views when route changes
 */
export function usePageView() {
  useEffect(() => {
    // Page view is tracked automatically by tracker.js
    // But you can add custom data if needed
    if (window.Insight && window.Insight.trackPageView) {
      window.Insight.trackPageView({
        metadata: {
          framework: 'react'
        }
      });
    }
  }, []);
}

/**
 * Hook: Track custom events
 */
export function useTrackEvent() {
  return (eventType, eventValue, metadata = {}) => {
    if (window.Insight && window.Insight.track) {
      window.Insight.track({
        event_type: eventType,
        event_value: eventValue,
        metadata: {
          timestamp: new Date().toISOString(),
          ...metadata
        }
      });
    } else {
      console.warn('Insight tracker not initialized');
    }
  };
}

/**
 * Example Component: E-commerce Product Page
 */
export function ProductPage() {
  const track = useTrackEvent();
  usePageView();

  const handleAddToCart = (productId, productName) => {
    track('add-to-cart', productId, {
      productName,
      category: 'electronics',
      price: 299.99
    });
  };

  const handleWishlist = (productId) => {
    track('wishlist', productId, {
      action: 'added'
    });
  };

  const handleShare = (platform) => {
    track('share', platform, {
      contentType: 'product'
    });
  };

  return (
    <div className="product-page">
      <h1>Premium Wireless Headphones</h1>
      <p>High-quality audio for everyday use</p>

      <button onClick={() => handleAddToCart('prod-123', 'Wireless Headphones')}>
        🛒 Add to Cart
      </button>

      <button onClick={() => handleWishlist('prod-123')}>
        ❤️ Add to Wishlist
      </button>

      <div className="share-buttons">
        <button onClick={() => handleShare('facebook')}>Share on Facebook</button>
        <button onClick={() => handleShare('twitter')}>Share on Twitter</button>
        <button onClick={() => handleShare('whatsapp')}>Share on WhatsApp</button>
      </div>
    </div>
  );
}

/**
 * Example Component: Analytics Context
 * 
 * Wrap your app with this to provide tracking throughout the component tree
 */
export const AnalyticsContext = React.createContext();

export function AnalyticsProvider({ children }) {
  const track = useTrackEvent();
  
  useEffect(() => {
    InitializeInsight();
  }, []);

  return (
    <AnalyticsContext.Provider value={{ track }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = React.useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  }
  return context;
}

/**
 * Example: Using analytics context in a component
 */
export function CheckoutButton() {
  const { track } = useAnalytics();

  const handleCheckout = () => {
    track('checkout-initiated', 'standard', {
      cartTotal: 599.98,
      itemCount: 2
    });
    // Proceed with checkout...
  };

  return (
    <button onClick={handleCheckout}>
      Proceed to Checkout
    </button>
  );
}

/**
 * Example App Setup (main.jsx style)
 * 
 * import React from 'react'
 * import ReactDOM from 'react-dom/client'
 * import App from './App'
 * import { AnalyticsProvider } from './analytics'
 * 
 * ReactDOM.createRoot(document.getElementById('root')).render(
 *   <React.StrictMode>
 *     <AnalyticsProvider>
 *       <App />
 *     </AnalyticsProvider>
 *   </React.StrictMode>,
 * )
 */

export default { InitializeInsight, usePageView, useTrackEvent, AnalyticsProvider, useAnalytics };
