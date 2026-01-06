export const ANALYTICS_INDEX = 'analytics-events';

export const analyticsMapping = {
  settings: {
    number_of_shards: 3,
    number_of_replicas: 1,
    refresh_interval: '1s',
    index: {
      mapping: {
        coerce: false
      }
    }
  },
  mappings: {
    dynamic: 'strict',
    properties: {
      eventId: {
        type: 'keyword'
      },
      userId: {
        type: 'long'
      },
      sessionId: {
        type: 'keyword'
      },
      eventType: {
        type: 'keyword'
      },
      timestamp: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis'
      },
      properties: {
        type: 'object',
        enabled: true,
        dynamic: true
      },
      metadata: {
        type: 'object',
        properties: {
          source: {
            type: 'keyword'
          },
          version: {
            type: 'keyword'
          },
          processedAt: {
            type: 'date'
          }
        }
      },
      indexedAt: {
        type: 'date'
      },
      processingTimeMs: {
        type: 'integer'
      }
    }
  }
};

export const ilmPolicy = {
  policy: {
    phases: {
      hot: {
        min_age: '0ms',
        actions: {
          rollover: {
            max_age: '1d',
            max_primary_shard_size: '50gb'
          },
          set_priority: {
            priority: 100
          }
        }
      },
      warm: {
        min_age: '7d',
        actions: {
          shrink: {
            number_of_shards: 1
          },
          forcemerge: {
            max_num_segments: 1
          },
          set_priority: {
            priority: 50
          }
        }
      },
      delete: {
        min_age: '30d',
        actions: {
          delete: {}
        }
      }
    }
  }
};
