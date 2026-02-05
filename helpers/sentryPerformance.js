import * as Sentry from "@sentry/react-native";
import { useCallback, useEffect, useRef } from "react";

/**
 * Performance Monitoring Utilities for Sentry
 */

// ============================================
// CUSTOM HOOKS
// ============================================

/**
 * Hook to track screen render performance
 *
 * @example
 * const MyScreen = () => {
 *   useScreenPerformance('HomeScreen');
 *   return <View>...</View>
 * }
 */
export const useScreenPerformance = (screenName) => {
  useEffect(() => {
    // Use modern Sentry API
    const cleanup = Sentry.startSpan(
      {
        name: `Screen: ${screenName}`,
        op: "screen.load",
        attributes: {
          screen: screenName,
        },
      },
      (span) => {
        // Add breadcrumb
        Sentry.addBreadcrumb({
          category: "navigation",
          message: `Screen rendered: ${screenName}`,
          level: "info",
        });

        // Return cleanup function
        return () => {
          span?.setStatus({ code: 1, message: "ok" });
        };
      },
    );

    return cleanup;
  }, [screenName]);
};

/**
 * Hook to track component render performance
 *
 * @example
 * const MyComponent = () => {
 *   useComponentPerformance('UserProfile');
 *   return <View>...</View>
 * }
 */
export const useComponentPerformance = (componentName) => {
  const renderCount = useRef(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current += 1;
    const renderTime = Date.now() - startTime.current;

    // Track slow renders (>16ms for 60fps)
    if (renderTime > 16) {
      Sentry.addBreadcrumb({
        category: "performance",
        message: `Slow render: ${componentName}`,
        level: "warning",
        data: {
          renderTime,
          renderCount: renderCount.current,
        },
      });
    }

    startTime.current = Date.now();
  });
};

/**
 * Hook to track API call performance
 *
 * @example
 * const { trackApiCall } = useApiPerformance();
 *
 * const fetchData = async () => {
 *   await trackApiCall('fetchUsers', async () => {
 *     return await fetch('/api/users');
 *   });
 * }
 */
export const useApiPerformance = () => {
  const trackApiCall = useCallback(async (apiName, apiCall, tags) => {
    const transaction = Sentry.startTransaction({
      name: `API: ${apiName}`,
      op: "http.client",
      tags: {
        api: apiName,
        ...tags,
      },
    });

    const startTime = Date.now();

    try {
      const result = await apiCall();
      const duration = Date.now() - startTime;

      transaction.setStatus("ok");
      transaction.setData("duration", duration);

      // Add breadcrumb for successful API call
      Sentry.addBreadcrumb({
        category: "http",
        message: `API call succeeded: ${apiName}`,
        level: "info",
        data: {
          duration,
        },
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      transaction.setStatus("error");
      transaction.setData("duration", duration);

      // Capture the error
      Sentry.captureException(error, {
        tags: {
          api: apiName,
          operation: "api_call",
        },
        contexts: {
          api: {
            name: apiName,
            duration,
          },
        },
      });

      throw error;
    } finally {
      transaction.finish();
    }
  }, []);

  return { trackApiCall };
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Track a custom operation's performance
 *
 * @example
 * await trackPerformance('image-processing', async () => {
 *   // Your processing logic
 *   await processImage();
 * });
 */
export async function trackPerformance(operationName, operation, options) {
  const transaction = Sentry.startTransaction({
    name: operationName,
    op: "custom.operation",
    tags: options?.tags,
  });

  const startTime = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    transaction.setStatus("ok");
    if (options?.data) {
      Object.entries(options.data).forEach(([key, value]) => {
        transaction.setData(key, value);
      });
    }
    transaction.setData("duration_ms", duration);

    return result;
  } catch (error) {
    transaction.setStatus("error");
    Sentry.captureException(error, {
      tags: {
        operation: operationName,
        ...options?.tags,
      },
    });
    throw error;
  } finally {
    transaction.finish();
  }
}

/**
 * Track synchronous operation performance
 *
 * @example
 * const result = trackSyncPerformance('heavy-calculation', () => {
 *   return calculateComplexResult();
 * });
 */
export function trackSyncPerformance(operationName, operation, options) {
  const startTime = Date.now();

  try {
    const result = operation();
    const duration = Date.now() - startTime;

    // Warn if operation is slow
    const threshold = options?.warnThreshold || 100; // default 100ms
    if (duration > threshold) {
      Sentry.addBreadcrumb({
        category: "performance",
        message: `Slow operation: ${operationName}`,
        level: "warning",
        data: {
          duration,
          threshold,
        },
      });
    }

    return result;
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        operation: operationName,
        type: "sync",
        ...options?.tags,
      },
    });
    throw error;
  }
}

/**
 * Create a span within a transaction
 * Useful for tracking sub-operations
 *
 * @example
 * const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
 * await measureSpan(transaction, 'database-query', async () => {
 *   return await db.query();
 * });
 */
export async function measureSpan(transaction, spanName, operation, options) {
  if (!transaction) {
    return operation();
  }

  const span = transaction.startChild({
    op: options?.op || "custom.span",
    description: spanName,
    tags: options?.tags,
  });

  try {
    const result = await operation();
    span.setStatus("ok");
    return result;
  } catch (error) {
    span.setStatus("error");
    throw error;
  } finally {
    span.finish();
  }
}

/**
 * Track user interaction performance
 *
 * @example
 * <Button onPress={() => trackInteraction('submit-form', () => handleSubmit())} />
 */
export function trackInteraction(interactionName, handler) {
  return async () => {
    const transaction = Sentry.startTransaction({
      name: `Interaction: ${interactionName}`,
      op: "user.interaction",
      tags: {
        interaction: interactionName,
      },
    });

    try {
      await handler();
      transaction.setStatus("ok");
    } catch (error) {
      transaction.setStatus("error");
      Sentry.captureException(error, {
        tags: {
          interaction: interactionName,
        },
      });
      throw error;
    } finally {
      transaction.finish();
    }
  };
}

/**
 * Measure and report slow frames
 * Call this in screens where you want to monitor frame rate
 */
export const useFrameRateMonitoring = (screenName) => {
  useEffect(() => {
    const frameRateInterval = setInterval(() => {
      // This is a simplified version
      // In production, you'd use a native module for accurate frame rate
      const now = Date.now();

      Sentry.addBreadcrumb({
        category: "performance",
        message: `Frame rate check: ${screenName}`,
        level: "debug",
        data: {
          screen: screenName,
          timestamp: now,
        },
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(frameRateInterval);
  }, [screenName]);
};

/**
 * Custom performance markers
 * Use these to mark important moments in your app
 */
export const PerformanceMarkers = {
  mark: (markerName, data) => {
    Sentry.addBreadcrumb({
      category: "performance.marker",
      message: markerName,
      level: "info",
      data,
    });
  },

  startMeasure: (measureName) => {
    const startTime = Date.now();
    return {
      finish: (data) => {
        const duration = Date.now() - startTime;
        Sentry.addBreadcrumb({
          category: "performance.measure",
          message: measureName,
          level: "info",
          data: {
            duration,
            ...data,
          },
        });
        return duration;
      },
    };
  },
};

/**
 * Track memory usage (if available)
 */
export const trackMemoryUsage = (context) => {
  // Note: This requires additional native modules for accurate readings
  // This is a placeholder implementation
  Sentry.addBreadcrumb({
    category: "performance.memory",
    message: `Memory check: ${context}`,
    level: "debug",
  });
};
