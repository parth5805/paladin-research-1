/**
 * @file Logger.ts
 * @description Production-ready logging for the lending platform
 */
import { Logger as WinstonLogger } from 'winston';
export declare const Logger: {
    info: (message: string, meta?: any) => WinstonLogger;
    error: (message: string, meta?: any) => WinstonLogger;
    warn: (message: string, meta?: any) => WinstonLogger;
    debug: (message: string, meta?: any) => WinstonLogger;
};
//# sourceMappingURL=Logger.d.ts.map