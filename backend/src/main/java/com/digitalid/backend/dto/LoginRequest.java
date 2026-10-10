package com.digitalid.backend.dto;
import jakarta.validation.constraints.NotBlank;
public class LoginRequest {
    @NotBlank private String identifier;
    @NotBlank private String password;
    public String getIdentifier() { return identifier; }
    public void setIdentifier(String v) { identifier = v; }
    public String getPassword() { return password; }
    public void setPassword(String v) { password = v; }
}
