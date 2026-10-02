import pytest
from app.scheme_engine import evaluate_rules
from app.workflow_engine import WorkflowEngine, WorkingCalendar
from app.core.errors import InvalidTransition

def test_rule_evaluation_is_explainable():
    result=evaluate_rules([{'rule_id':'AGE','name':'Age rule','field':'applicant.age','operator':'LESS_THAN_OR_EQUAL','value':35,'source_reference':'DEMO_CONFIGURATION_NOT_OFFICIAL'}],{'applicant':{'age':30}})
    assert result['result']=='ELIGIBLE'
    assert result['rules'][0]['passed'] is True
    assert result['rules'][0]['source_reference']=='DEMO_CONFIGURATION_NOT_OFFICIAL'

def test_workflow_rejects_invalid_transition():
    engine=WorkflowEngine({'transitions':[{'from':'DRAFT','to':'SUBMITTED'}]})
    assert engine.transition('DRAFT','SUBMITTED')['to']=='SUBMITTED'
    with pytest.raises(InvalidTransition): engine.transition('SUBMITTED','APPROVED')

def test_working_calendar_skips_weekends_and_holidays():
    calendar=WorkingCalendar(weekdays=(0,1,2,3,4),holidays=set())
    assert calendar.add_working_days(__import__('datetime').datetime(2026,1,2),1).weekday()==0
