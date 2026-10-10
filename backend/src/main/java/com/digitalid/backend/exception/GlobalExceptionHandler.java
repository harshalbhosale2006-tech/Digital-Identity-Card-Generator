package com.digitalid.backend.exception;
import com.digitalid.backend.dto.ApiError;
import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
@RestControllerAdvice
public class GlobalExceptionHandler {
    private ResponseEntity<ApiError> error(HttpStatus s, String m) { return ResponseEntity.status(s).body(new ApiError(Instant.now(),s.value(),s.getReasonPhrase(),m,Map.of())); }
    @ExceptionHandler(NotFoundException.class) public ResponseEntity<ApiError> notFound(NotFoundException e){return error(HttpStatus.NOT_FOUND,e.getMessage());}
    @ExceptionHandler(UnauthorizedException.class) public ResponseEntity<ApiError> unauthorized(UnauthorizedException e){return error(HttpStatus.UNAUTHORIZED,e.getMessage());}
    @ExceptionHandler(ConflictException.class) public ResponseEntity<ApiError> conflict(ConflictException e){return error(HttpStatus.CONFLICT,e.getMessage());}
    @ExceptionHandler(MethodArgumentNotValidException.class) public ResponseEntity<ApiError> invalid(MethodArgumentNotValidException e){
        Map<String,String> fields=new LinkedHashMap<>(); e.getBindingResult().getFieldErrors().forEach(x->fields.putIfAbsent(x.getField(),x.getDefaultMessage()));
        return ResponseEntity.badRequest().body(new ApiError(Instant.now(),400,"Bad Request","Validation failed",fields));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class,ConstraintViolationException.class,IllegalArgumentException.class})
    public ResponseEntity<ApiError> badRequest(Exception e){return error(HttpStatus.BAD_REQUEST,e instanceof IllegalArgumentException ? e.getMessage() : "Invalid request data. Check the field formats.");}
    @ExceptionHandler(DataIntegrityViolationException.class) public ResponseEntity<ApiError> integrity(DataIntegrityViolationException e){return error(HttpStatus.CONFLICT,"A record with the same unique value already exists.");}
    @ExceptionHandler(Exception.class) public ResponseEntity<ApiError> unexpected(Exception e){return error(HttpStatus.INTERNAL_SERVER_ERROR,"An unexpected server error occurred.");}
}
