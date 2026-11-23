import { z } from 'zod';

const envSchema = z.object({
	DATA_ROOT: z.string().min(1),
	HOST: z.string().min(1),
	PORT: z.coerce.number().int().positive().max(65535),
});

export type ServerConfig = {
	root: string;
	host: string;
	port: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
	const parsed = envSchema.parse(env);
	return {
		root: parsed.DATA_ROOT,
		host: parsed.HOST,
		port: parsed.PORT,
	};
}
