import pytest
from app.storage.service import MockStorageProvider, ImageKitStorageProvider
from app.integrations.notification_providers import MockEmailProvider, SMTPEmailProvider

@pytest.mark.asyncio
async def test_mock_email_provider_is_safe():
    result=await MockEmailProvider().send('user@example.com','Subject','Body','<p>Body</p>')
    assert result.accepted is True
    assert result.provider=='mock-email'

def test_mock_storage_upload_and_signed_url():
    provider=MockStorageProvider()
    stored=provider.upload(b'abc','../certificate.pdf','application/pdf')
    assert stored.provider=='mock'
    assert stored.sha256
    assert 'certificate.pdf' in stored.key
    assert 'expires_in=300' in provider.get_signed_url(stored.key)

def test_imagekit_signed_url_does_not_expose_private_key():
    provider=ImageKitStorageProvider('private-secret','public-key','https://ik.example','mota/docs')
    url=provider.get_signed_url('mota/docs/file.pdf',300)
    assert url.startswith('https://ik.example/')
    assert 'private-secret' not in url
    assert 'ik-s=' in url and 'ik-t=' in url

@pytest.mark.asyncio
async def test_smtp_provider_sends_html_without_logging_secrets(monkeypatch):
    captured={}
    async def fake_send(message, **kwargs):
        captured['message']=message; captured['kwargs']=kwargs
        return ('250 OK', {})
    monkeypatch.setattr('aiosmtplib.send',fake_send)
    result=await SMTPEmailProvider('smtp.gmail.com',587,'user@gmail.com','app-password','from@gmail.com','MoTA').send('to@example.com','Hi','plain','<b>Hi</b>')
    assert result.accepted is True
    assert captured['message']['To']=='to@example.com'
    assert captured['kwargs']['start_tls'] is True
    assert 'app-password' not in str(captured['message'])
