package logger

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

var (
	warnStyle    = lipgloss.NewStyle().Background(lipgloss.Color("220")).Foreground(lipgloss.Color("0")).Bold(true)
	infoStyle    = lipgloss.NewStyle().Background(lipgloss.Color("34")).Foreground(lipgloss.Color("255")).Bold(true)
	errorStyle   = lipgloss.NewStyle().Background(lipgloss.Color("196")).Foreground(lipgloss.Color("255")).Bold(true)
	initStyle    = lipgloss.NewStyle().Background(lipgloss.Color("33")).Foreground(lipgloss.Color("255")).Bold(true)
	debugStyle   = lipgloss.NewStyle().Background(lipgloss.Color("240")).Foreground(lipgloss.Color("255")).Bold(true)
	shardiStyle  = lipgloss.NewStyle().Background(lipgloss.Color("99")).Foreground(lipgloss.Color("255")).Bold(true)
	websiteStyle = lipgloss.NewStyle().Background(lipgloss.Color("208")).Foreground(lipgloss.Color("0")).Bold(true)
	customStyle  = lipgloss.NewStyle().Background(lipgloss.Color("245")).Foreground(lipgloss.Color("255")).Bold(true)
)

const levelWidth = 7

func renderLevel(level Level, color bool) string {
	levelStr := string(level)

	for len(levelStr) < levelWidth {
		levelStr += " "
	}

	if !color {
		return levelStr
	}

	var style lipgloss.Style
	switch level {
	case LevelWarn:
		style = warnStyle
	case LevelInfo:
		style = infoStyle
	case LevelError:
		style = errorStyle
	case LevelInit:
		style = initStyle
	case LevelDebug:
		style = debugStyle
	case LevelShardi:
		style = shardiStyle
	case LevelWebsite:
		style = websiteStyle
	default:
		style = customStyle
	}

	return style.Render(" " + strings.TrimSpace(levelStr) + " ")
}
