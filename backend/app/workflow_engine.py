from datetime import datetime, timedelta, timezone
from app.core.errors import InvalidTransition
class WorkflowEngine:
    def __init__(self, definition:dict): self.definition=definition
    def available(self,current,context=None):
        return [x for x in self.definition.get("transitions",[]) if x.get("from")==current and self._conditions(x,context or {})]
    def transition(self,current,target,context=None):
        matches=[x for x in self.available(current,context) if x.get("to")==target]
        if not matches: raise InvalidTransition(f"Cannot transition from {current} to {target}")
        return matches[0]
    def _conditions(self,transition,context):
        return all(context.get(k)==v for k,v in transition.get("conditions",{}).items())
class WorkingCalendar:
    def __init__(self,weekdays=(0,1,2,3,4),holidays=()): self.weekdays=set(weekdays); self.holidays=set(holidays)
    def add_working_days(self,start,days):
        current=start; remaining=days
        while remaining:
            current+=timedelta(days=1)
            if current.weekday() in self.weekdays and current.date() not in self.holidays: remaining-=1
        return current
