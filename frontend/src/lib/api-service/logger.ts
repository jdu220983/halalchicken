/**
 * Production-grade logging utility with levels and structured logging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  timestamp: string
  message: string
  data?: Record<string, any>
  stack?: string
}

class Logger {
  private isDevelopment = import.meta.env.DEV
  private logBuffer: LogEntry[] = []
  private maxBufferSize = 100

  private formatMessage(level: LogLevel, message: string, data?: Record<string, any>): string {
    const timestamp = new Date().toISOString()
    const dataStr = data ? ` | ${JSON.stringify(data)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry)
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift()
    }
  }

  debug(message: string, data?: Record<string, any>): void {
    const formatted = this.formatMessage('debug', message, data)
    if (this.isDevelopment) {
      console.debug(formatted)
    }
    this.addToBuffer({
      level: 'debug',
      timestamp: new Date().toISOString(),
      message,
      data,
    })
  }

  info(message: string, data?: Record<string, any>): void {
    const formatted = this.formatMessage('info', message, data)
    console.info(formatted)
    this.addToBuffer({
      level: 'info',
      timestamp: new Date().toISOString(),
      message,
      data,
    })
  }

  warn(message: string, data?: Record<string, any>): void {
    const formatted = this.formatMessage('warn', message, data)
    console.warn(formatted)
    this.addToBuffer({
      level: 'warn',
      timestamp: new Date().toISOString(),
      message,
      data,
    })
  }

  error(message: string, data?: Record<string, any>, error?: Error): void {
    const formatted = this.formatMessage('error', message, data)
    console.error(formatted, error)
    this.addToBuffer({
      level: 'error',
      timestamp: new Date().toISOString(),
      message,
      data,
      stack: error?.stack,
    })
  }

  /**
   * Get all buffered logs for debugging or reporting
   */
  getLogs(): LogEntry[] {
    return [...this.logBuffer]
  }

  /**
   * Clear log buffer
   */
  clearLogs(): void {
    this.logBuffer = []
  }

  /**
   * Export logs as JSON string for error reporting
   */
  exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2)
  }
}

export const logger = new Logger()
