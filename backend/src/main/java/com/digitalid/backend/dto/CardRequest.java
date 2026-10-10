package com.digitalid.backend.dto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.Map;
public class CardRequest {
    @NotBlank @Size(max=120) private String fullName;
    @NotBlank @Size(max=60) private String idNumber;
    @PastOrPresent private LocalDate dob;
    @Size(max=120) private String department;
    @Size(max=120) private String course;
    @Size(max=40) private String year;
    @Size(max=40) private String semester;
    @Email @Size(max=160) private String email;
    @Size(max=30) private String phone;
    @Size(max=8) private String bloodGroup;
    @Size(max=1000) private String address;
    private String photo;
    @Size(max=20) private String status;
    @Size(max=32) private String cardType = "STUDENT";
    private Map<String, String> categoryDetails;
    public String getFullName(){return fullName;} public void setFullName(String v){fullName=v;}
    public String getIdNumber(){return idNumber;} public void setIdNumber(String v){idNumber=v;}
    public LocalDate getDob(){return dob;} public void setDob(LocalDate v){dob=v;}
    public String getDepartment(){return department;} public void setDepartment(String v){department=v;}
    public String getCourse(){return course;} public void setCourse(String v){course=v;}
    public String getYear(){return year;} public void setYear(String v){year=v;}
    public String getSemester(){return semester;} public void setSemester(String v){semester=v;}
    public String getEmail(){return email;} public void setEmail(String v){email=v;}
    public String getPhone(){return phone;} public void setPhone(String v){phone=v;}
    public String getBloodGroup(){return bloodGroup;} public void setBloodGroup(String v){bloodGroup=v;}
    public String getAddress(){return address;} public void setAddress(String v){address=v;}
    public String getPhoto(){return photo;} public void setPhoto(String v){photo=v;}
    public String getStatus(){return status;} public void setStatus(String v){status=v;}
    public String getCardType(){return cardType;} public void setCardType(String v){cardType=v;}
    public Map<String,String> getCategoryDetails(){return categoryDetails;} public void setCategoryDetails(Map<String,String> v){categoryDetails=v;}
}
