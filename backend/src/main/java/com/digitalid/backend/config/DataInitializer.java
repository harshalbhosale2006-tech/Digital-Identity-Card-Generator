package com.digitalid.backend.config;
import com.digitalid.backend.entity.AdminUser;
import com.digitalid.backend.repository.AdminUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
@Configuration
public class DataInitializer {
    @Bean CommandLineRunner initializeAdmin(AdminUserRepository repo, PasswordEncoder encoder,
        @Value("${app.admin.name}") String name, @Value("${app.admin.email}") String email,
        @Value("${app.admin.username}") String username, @Value("${app.admin.password}") String password) {
        return args -> { if (!repo.existsByEmailIgnoreCase(email) && !repo.existsByUsernameIgnoreCase(username)) {
            AdminUser a=new AdminUser(); a.setName(name); a.setEmail(email); a.setUsername(username); a.setPasswordHash(encoder.encode(password)); repo.save(a);
        }};
    }
}
