
Please refactor the codebase to support both Azure Cloud and Azurite Emulator connections using Dependency Injection. Apply the following changes strictly:

### 1. Update `config.py`
In the `ConfigData` dataclass, update the types for the connection variables to allow `None`, as one of them might be missing depending on the environment.

```python
    cloud_rpt_2_storage_account_url: str | None = None
    emulator_connection_string: str | None = None
```

In the `Config` class, update the `validate` method to ensure at least one connection method is provided when `runtime_context` is `CLOUD`. Replace the existing `validate` method with this:

```python
    @staticmethod
    def validate(config: 'ConfigData') -> None:
        required_fields = [("RUNTIME_CONTEXT", config.runtime_context)]
        missing = [field for field, value in required_fields if not value]
        if missing:
            raise ValidationError(f"Missing required configuration: {', '.join(missing)}")

        if config.runtime_context == RuntimeContext.ONPREM:
            required_fields = Config.get_required_fields_onprem(config)
        elif config.runtime_context == RuntimeContext.CLOUD:
            required_fields = Config.get_required_fields_cloud(config)
            
            # Check connection config for cloud environment
            if not config.cloud_rpt_2_storage_account_url and not config.emulator_connection_string:
                raise ValidationError("Must provide either CLOUD_RPT_2_STORAGE_ACCOUNT_URL or EMULATOR_CONNECTION_STRING")

        # re-validate fields based on configs passed
        missing = [field for field, value in required_fields if not value]
        if missing:
            raise ValidationError(f"Missing required configuration: {', '.join(missing)}")
```

