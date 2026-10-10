package com.digitalid.backend.interceptor;
import com.digitalid.backend.exception.UnauthorizedException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.HandlerInterceptor;
public class SessionAuthInterceptor implements HandlerInterceptor {
    @Override public boolean preHandle(HttpServletRequest request,HttpServletResponse response,Object handler){
        if("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;
        var session=request.getSession(false);
        if(session==null || session.getAttribute("ADMIN_ID")==null) throw new UnauthorizedException("Please log in to access this resource.");
        return true;
    }
}
