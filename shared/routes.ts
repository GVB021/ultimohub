import { z } from 'zod';
import {
  insertStudioSchema,
  insertProductionSchema,
  insertSessionSchema,
  insertCharacterSchema,
  insertStaffSchema,
} from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

const userSchema = z.object({
  id: z.string(),
  email: z.string().nullable().optional(),
  role: z.string(),
  status: z.string(),
  fullName: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  artistName: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  specialty: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  profileImageUrl: z.string().nullable().optional(),
});

const studioSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional(),
  userRoles: z.array(z.string()).optional(),
});

const studioAutoEntrySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("redirect"),
    studioId: z.string(),
    target: z.string(),
    count: z.number(),
  }),
  z.object({
    mode: z.literal("select"),
    count: z.number(),
  }),
]);

const productionSchema = z.object({
  id: z.string(),
  studioId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  videoUrl: z.string().nullable(),
  scriptJson: z.string().nullable(),
  status: z.string(),
});

const characterSchema = z.object({
  id: z.string(),
  productionId: z.string(),
  name: z.string(),
  voiceActorId: z.string().nullable(),
});

const sessionSchema = z.object({
  id: z.string(),
  productionId: z.string(),
  studioId: z.string(),
  title: z.string(),
  scheduledAt: z.string().or(z.date()).transform(val => new Date(val).toISOString()),
  durationMinutes: z.number(),
  status: z.string(),
  storageProvider: z.string().optional(),
  takesPath: z.string().optional(),
});

const staffSchema = z.object({
  id: z.string(),
  studioId: z.string(),
  name: z.string(),
  role: z.string(),
});

export const api = {
  auth: {
    me: {
      method: 'GET' as const,
      path: '/api/auth/user' as const,
      responses: {
        200: userSchema,
        401: errorSchemas.unauthorized,
      }
    }
  },
  studios: {
    list: {
      method: 'GET' as const,
      path: '/api/studios' as const,
      responses: {
        200: z.array(studioSchema),
      }
    },
    autoEntry: {
      method: 'GET' as const,
      path: '/api/studios/auto-entry' as const,
      responses: {
        200: studioAutoEntrySchema,
        404: errorSchemas.notFound,
      }
    },
    get: {
      method: 'GET' as const,
      path: '/api/studios/:studioId' as const,
      responses: {
        200: studioSchema,
        404: errorSchemas.notFound,
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/studios' as const,
      input: insertStudioSchema.omit({ slug: true, ownerId: true }).partial().extend({ name: z.string().min(1) }),
      responses: {
        201: studioSchema,
      }
    }
  },
  productions: {
    list: {
      method: 'GET' as const,
      path: '/api/studios/:studioId/productions' as const,
      responses: {
        200: z.array(productionSchema),
      }
    },
    get: {
      method: 'GET' as const,
      path: '/api/studios/:studioId/productions/:id' as const,
      responses: {
        200: productionSchema,
        404: errorSchemas.notFound,
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/studios/:studioId/productions' as const,
      input: z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        videoUrl: z.string().optional(),
        scriptJson: z.string().optional(),
        status: z.string().optional(),
      }),
      responses: {
        201: productionSchema,
      }
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/studios/:studioId/productions/:id' as const,
      input: z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        videoUrl: z.string().optional(),
        scriptJson: z.string().optional(),
        status: z.string().optional(),
      }),
      responses: {
        200: productionSchema,
        404: errorSchemas.notFound,
      }
    }
  },
  characters: {
    list: {
      method: 'GET' as const,
      path: '/api/productions/:productionId/characters' as const,
      responses: {
        200: z.array(characterSchema),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/productions/:productionId/characters' as const,
      input: z.object({
        name: z.string().min(1),
        voiceActorId: z.string().nullable().optional(),
      }),
      responses: {
        201: characterSchema,
      }
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/productions/:productionId/characters/:id' as const,
      input: z.object({
        name: z.string().optional(),
        voiceActorId: z.string().nullable().optional(),
      }),
      responses: {
        200: characterSchema,
        404: errorSchemas.notFound,
      }
    }
  },
  sessions: {
    list: {
      method: 'GET' as const,
      path: '/api/studios/:studioId/sessions' as const,
      responses: {
        200: z.array(sessionSchema),
      }
    },
    get: {
      method: 'GET' as const,
      path: '/api/studios/:studioId/sessions/:id' as const,
      responses: {
        200: sessionSchema,
        404: errorSchemas.notFound,
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/studios/:studioId/sessions' as const,
      input: z.object({
        title: z.string().min(1),
        productionId: z.string(),
        scheduledAt: z.string(),
        durationMinutes: z.number().optional(),
        status: z.string().optional(),
        storageProvider: z.enum(["supabase", "local"]).optional(),
        takesPath: z.string().optional(),
      }),
      responses: {
        201: sessionSchema,
      }
    }
  },
  staff: {
    list: {
      method: 'GET' as const,
      path: '/api/studios/:studioId/staff' as const,
      responses: {
        200: z.array(staffSchema),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/studios/:studioId/staff' as const,
      input: z.object({
        name: z.string().min(1),
        role: z.string().min(1),
      }),
      responses: {
        201: staffSchema,
      }
    }
  },
  audit: {
    list: {
      method: 'GET' as const,
      path: '/api/audit' as const,
      responses: {
        200: z.array(z.object({
          id: z.string(),
          userId: z.string().nullable(),
          action: z.string(),
          createdAt: z.union([z.string(), z.date()]).optional(),
        })),
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
