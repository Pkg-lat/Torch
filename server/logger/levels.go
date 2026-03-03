package logger

type Level string

const (
	LevelWarn    Level = "warn"
	LevelInfo    Level = "info"
	LevelError   Level = "error"
	LevelInit    Level = "init"
	LevelDebug   Level = "debug"
	LevelShardi  Level = "shardi" /* use later when we bring in sharding and what not*/
	LevelWebsite Level = "website"
)

func (l Level) String() string {
	return string(l)
}
