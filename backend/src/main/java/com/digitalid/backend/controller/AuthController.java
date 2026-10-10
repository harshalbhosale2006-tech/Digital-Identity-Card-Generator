package com.digitalid.backend.controller;
import com.digitalid.backend.dto.LoginRequest;
import com.digitalid.backend.dto.LoginResponse;
import com.digitalid.backend.entity.AdminUser;
import com.digitalid.backend.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    public AuthController(AuthService auth){this.auth=auth;}
    @PostMapping("/login") public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request,HttpServletRequest servletRequest){
        AdminUser user=auth.login(request.getIdentifier(),request.getPassword());HttpSession old=servletRequest.getSession(false);if(old!=null)old.invalidate();HttpSession session=servletRequest.getSession(true);session.setAttribute("ADMIN_ID",user.getId());return ResponseEntity.ok(response(user,"Login successful."));
    }
    @GetMapping("/me") public ResponseEntity<LoginResponse> me(HttpServletRequest request){HttpSession session=request.getSession(false);if(session==null||session.getAttribute("ADMIN_ID")==null)return ResponseEntity.status(401).build();return ResponseEntity.ok(response(auth.findById((Long)session.getAttribute("ADMIN_ID")),"Authenticated."));}
    @PostMapping("/logout") public ResponseEntity<?> logout(HttpServletRequest request){HttpSession session=request.getSession(false);if(session!=null)session.invalidate();return ResponseEntity.ok(java.util.Map.of("message","Logout successful."));}
    private LoginResponse response(AdminUser u,String m){return new LoginResponse(u.getId(),u.getName(),u.getEmail(),u.getUsername(),m);}
}
