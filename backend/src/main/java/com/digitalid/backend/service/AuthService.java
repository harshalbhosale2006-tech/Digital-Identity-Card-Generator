package com.digitalid.backend.service;
import com.digitalid.backend.entity.AdminUser;
import com.digitalid.backend.exception.UnauthorizedException;
import com.digitalid.backend.repository.AdminUserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
@Service
public class AuthService {
    private final AdminUserRepository users; private final PasswordEncoder encoder;
    public AuthService(AdminUserRepository users,PasswordEncoder encoder){this.users=users;this.encoder=encoder;}
    public AdminUser login(String identifier,String password){
        String value=identifier.trim(); AdminUser user=users.findFirstByEmailIgnoreCaseOrUsernameIgnoreCase(value,value).orElseThrow(()->new UnauthorizedException("Invalid username/email or password."));
        if(!encoder.matches(password,user.getPasswordHash())) throw new UnauthorizedException("Invalid username/email or password.");
        return user;
    }
    public AdminUser findById(Long id){return users.findById(id).orElseThrow(()->new UnauthorizedException("The current admin account no longer exists."));}
}
