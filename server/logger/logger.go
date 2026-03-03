package logger

import (
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

type Logger struct {
	mu          sync.Mutex
	out         io.Writer
	enableColor bool
}

func New(enableColor bool) *Logger {
	return &Logger{
		out:         os.Stdout,
		enableColor: enableColor,
	}
}

func (l *Logger) Warn(msg string) {
	l.log(LevelWarn, msg, nil)
}

func (l *Logger) Info(msg string) {
	l.log(LevelInfo, msg, nil)
}

func (l *Logger) Error(msg string, err error) {
	l.log(LevelError, msg, err)
}

func (l *Logger) Init(msg string) {
	l.log(LevelInit, msg, nil)
}

func (l *Logger) Debug(msg string) {
	l.log(LevelDebug, msg, nil)
}

func (l *Logger) log(level Level, msg string, err error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	var buf strings.Builder

	now := time.Now()
	month := itoa(int(now.Month()))
	if len(month) == 1 {
		month = "0" + month
	}
	day := itoa(now.Day())
	if len(day) == 1 {
		day = "0" + day
	}
	hour := itoa(now.Hour())
	if len(hour) == 1 {
		hour = "0" + hour
	}
	minute := itoa(now.Minute())
	if len(minute) == 1 {
		minute = "0" + minute
	}
	second := itoa(now.Second())
	if len(second) == 1 {
		second = "0" + second
	}

	if l.enableColor {
    // White text (foreground) + Grey background
    buf.WriteString("\033[38;5;255m") // text color (white)
    buf.WriteString("\033[48;5;240m ") // background color (grey)
}

buf.WriteString(month)
buf.WriteString("/")
buf.WriteString(day)
buf.WriteString(" ")
buf.WriteString(hour)
buf.WriteString(":")
buf.WriteString(minute)
buf.WriteString(":")
buf.WriteString(second)

if l.enableColor {
    buf.WriteString(" \033[0m") // reset
}


	levelTag := renderLevel(level, l.enableColor)
	buf.WriteString(levelTag)
	buf.WriteString("")

	caller := getCaller()
	if caller != "" {
		if l.enableColor {
    // White text + Blue background
    buf.WriteString("\033[38;5;255;48;5;27m ")
}

buf.WriteString(caller)

if l.enableColor {
    buf.WriteString("\033[0m ")
}

buf.WriteString(" ")

	}

	if l.enableColor {
		buf.WriteString("\033[38;5;250m")
	}
	buf.WriteString(msg)
	if l.enableColor {
		buf.WriteString("\033[0m")
	}
	buf.WriteString("\n")

	if err != nil {
		stack := parseStack(err)
		for _, line := range stack {
			buf.WriteString("    ")
			if l.enableColor {
				buf.WriteString("\033[38;5;240m")
			}
			buf.WriteString(line)
			if l.enableColor {
				buf.WriteString("\033[0m")
			}
			buf.WriteString("\n")
		}
	}

	l.out.Write([]byte(buf.String()))
}

func getCaller() string {
	const skip = 4
	pc, file, line, ok := runtime.Caller(skip)
	if !ok {
		return ""
	}

	fn := runtime.FuncForPC(pc)
	if fn == nil {
		return ""
	}

	funcName := fn.Name()
	if idx := strings.LastIndex(funcName, "/"); idx >= 0 {
		funcName = funcName[idx+1:]
	}

	file = filepath.Base(file)

	var buf strings.Builder
	buf.WriteString(file)
	buf.WriteString(":")
	buf.WriteString(itoa(line))
	buf.WriteString(" in ")
	buf.WriteString(funcName)

	return buf.String()
}

func parseStack(err error) []string {
	msg := err.Error()
	lines := strings.Split(msg, "\n")
	var stack []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			stack = append(stack, trimmed)
		}
	}
	return stack
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}

	neg := i < 0
	if neg {
		i = -i
	}

	var buf [20]byte
	pos := len(buf)

	for i > 0 {
		pos--
		buf[pos] = byte('0' + i%10)
		i /= 10
	}

	if neg {
		pos--
		buf[pos] = '-'
	}

	return string(buf[pos:])
}

var defaultLogger = New(true)

func Warn(msg string) {
	defaultLogger.Warn(msg)
}

func Info(msg string) {
	defaultLogger.Info(msg)
}

func Error(msg string, err error) {
	defaultLogger.Error(msg, err)
}

func Init(msg string) {
	defaultLogger.Init(msg)
}

func Debug(msg string) {
	defaultLogger.Debug(msg)
}
